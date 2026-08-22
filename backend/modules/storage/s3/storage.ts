import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { objectStorageModule, signingBaseUrl } from '../../../helpers/storageObjects.ts'
import type { ObjectStoreClient } from '../../../helpers/storageObjects.ts'
import type { StorageTarget } from '../../../models/storage.ts'

/** Live clients, keyed by target. See `clientFor`. */
const clients = new Map<string, { client: S3Client; fingerprint: string }>()

/** The settings a client is built from — a change to any of them needs a new one. */
function configFingerprint(target: StorageTarget): string {
  const c = target.config
  return JSON.stringify([c.endpoint, c.region, c.accessKeyId, c.secretAccessKey, c.forcePathStyle])
}

/**
 * The S3 client for this target, built once and kept.
 *
 * Rebuilt when the configuration changes, so a rotated key takes effect on the next operation rather
 * than at the next restart.
 *
 * **Credentials are optional.** Left empty, the SDK falls back to its own chain — an IAM role on the
 * instance, the standard `AWS_*` environment variables, a shared credentials file — which is how a
 * deployment avoids putting a long-lived secret in the database at all.
 */
function clientFor(target: StorageTarget): S3Client {
  const fingerprint = configFingerprint(target)
  const cached = clients.get(target.id)
  if (cached && cached.fingerprint === fingerprint) {
    return cached.client
  }
  const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = target.config
  const client = new S3Client({
    region: region || 'us-east-1',
    ...(endpoint ? { endpoint } : {}),
    ...(forcePathStyle ? { forcePathStyle: true } : {}),
    ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {})
  })
  clients.set(target.id, { client, fingerprint })
  return client
}

/**
 * The client and bucket a signature should be made against.
 *
 * SigV4 covers the `Host` header, so a URL signed for the bucket's own address and then rewritten
 * onto a CDN domain carries a signature for the wrong host and is rejected. The domain has to be
 * signed *for*, which means a client pointed at it rather than the ordinary client with its output
 * edited afterwards.
 *
 * Which of the two forms that takes depends on what sits at the domain, and `forcePathStyle` is the
 * target's existing answer to exactly that question for the store itself:
 *
 * - **off** — the domain *is* the bucket, which is what a Cloudflare R2 custom domain or a Spaces CDN
 *   endpoint is. The SDK spells this `bucketEndpoint`, and it means the `Bucket` *parameter* carries
 *   the URL: passing the bucket's name alongside it fails outright.
 * - **on** — the bucket is the first path segment, which is what a reverse proxy onto MinIO looks
 *   like, and the endpoint and the bucket name are then both ordinary.
 *
 * Not cached: signing is per request, and an administrator changing the base URL must not have to
 * wait for anything to expire before seeing it.
 */
function signingTargetFor(
  target: StorageTarget,
  baseUrl: string | null
): { client: S3Client; bucket: string } {
  if (!baseUrl) {
    return { client: clientFor(target), bucket: target.config.bucket }
  }
  const { region, accessKeyId, secretAccessKey, forcePathStyle } = target.config
  const credentials =
    accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}
  if (forcePathStyle) {
    return {
      client: new S3Client({
        region: region || 'us-east-1',
        endpoint: baseUrl,
        forcePathStyle: true,
        ...credentials
      }),
      bucket: target.config.bucket
    }
  }
  return {
    client: new S3Client({ region: region || 'us-east-1', bucketEndpoint: true, ...credentials }),
    bucket: baseUrl
  }
}

/** Whether the store is telling us the key simply is not there. */
function isNotFound(err: any): boolean {
  return (
    err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404
  )
}

const s3Client: ObjectStoreClient = {
  async put(target, key, data, contentType) {
    await clientFor(target).send(
      new PutObjectCommand({
        Bucket: target.config.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        // -> Omitted rather than sent as Standard: a compatible store that does not implement
        //    storage classes will reject the header outright rather than ignore it
        ...(target.config.storageClass && target.config.storageClass !== 'STANDARD'
          ? { StorageClass: target.config.storageClass }
          : {})
      })
    )
  },

  async get(target, key) {
    try {
      const resp = await clientFor(target).send(
        new GetObjectCommand({ Bucket: target.config.bucket, Key: key })
      )
      const bytes = await resp.Body?.transformToByteArray()
      return bytes ? Buffer.from(bytes) : null
    } catch (err: any) {
      if (isNotFound(err)) {
        // -> This target does not have the file: enabled after the upload, or removed from outside
        //    the wiki. Not a fault — the caller asks the next target.
        return null
      }
      throw err
    }
  },

  async remove(target, key) {
    try {
      await clientFor(target).send(
        new DeleteObjectCommand({ Bucket: target.config.bucket, Key: key })
      )
    } catch (err: any) {
      // -> S3 itself answers a delete of a missing key with success; not every compatible store does
      if (!isNotFound(err)) {
        throw err
      }
    }
  },

  async copy(target, fromKey, toKey) {
    try {
      await clientFor(target).send(
        new CopyObjectCommand({
          Bucket: target.config.bucket,
          // -> The source is bucket-qualified and URI-encoded, which is the one part of this API that
          //    does not take a plain key: a `#` or a `+` in a file name would otherwise be read as
          //    part of the URL rather than as part of the name
          CopySource: encodeURI(`${target.config.bucket}/${fromKey}`),
          Key: toKey
        })
      )
      return true
    } catch (err: any) {
      if (isNotFound(err)) {
        return false
      }
      throw err
    }
  },

  async presign(target, { key, expiresInSeconds, contentType, downloadAs }) {
    const { client, bucket } = signingTargetFor(target, signingBaseUrl(target))
    /*
      The response headers travel in the signature rather than being left to the object's own
      metadata: the wiki knows what it thinks the file is and whether this request was a download,
      and neither of those is necessarily what was stored — an object written by an older instance,
      or one uploaded straight into the bucket, carries whatever it carries.
    */
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentType: contentType,
        ...(downloadAs
          ? {
              ResponseContentDisposition: `attachment; filename="${encodeURIComponent(downloadAs)}"`
            }
          : {})
      }),
      { expiresIn: expiresInSeconds }
    )
  }
}

/**
 * S3 object storage module
 *
 * Amazon S3 and everything that speaks its API. One module rather than the three that 2.x shipped —
 * an AWS one, a DigitalOcean one and a custom one — because the difference between them is an
 * endpoint and a region, and treating that as a preset meant a new module for every service that
 * appeared. Empty endpoint is AWS; anything else is whichever store the URL points at.
 *
 * The keys are the same paths the disk target writes, so a bucket and a folder hold the wiki's content
 * laid out identically, and the shape of both is the site's `pathPrefixFor` to decide. See
 * `helpers/storageObjects.ts` for everything above the four calls below.
 */
export default objectStorageModule(s3Client)
