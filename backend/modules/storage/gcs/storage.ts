import { Storage } from '@google-cloud/storage'
import { objectStorageModule, signingBaseUrl } from '../../../helpers/storageObjects.ts'
import type { Bucket } from '@google-cloud/storage'
import type { ObjectStoreClient } from '../../../helpers/storageObjects.ts'
import type { StorageTarget } from '../../../models/storage.ts'

/** Live buckets, keyed by target. See `bucketFor`. */
const buckets = new Map<string, { bucket: Bucket; fingerprint: string }>()

/** The settings a client is built from — a change to any of them needs a new one. */
function configFingerprint(target: StorageTarget): string {
  const c = target.config
  return JSON.stringify([c.projectId, c.credentialsJSON, c.bucket, c.apiEndpoint])
}

/**
 * The bucket handle for this target, built once and kept.
 *
 * **The credentials are optional.** Left empty, the client falls back to Application Default
 * Credentials — the workload identity attached to a GKE pod or a Cloud Run service, or the
 * `GOOGLE_APPLICATION_CREDENTIALS` file — which is how a deployment on Google's own infrastructure
 * avoids putting a service account key in the database at all.
 *
 * @throws When the pasted credentials are not JSON, which is worth saying plainly: it is a long blob
 *   somebody pasted into a form, and the client's own error for it is not obviously about that
 */
function bucketFor(target: StorageTarget): Bucket {
  const fingerprint = configFingerprint(target)
  const cached = buckets.get(target.id)
  if (cached && cached.fingerprint === fingerprint) {
    return cached.bucket
  }
  const { projectId, credentialsJSON, bucket, apiEndpoint } = target.config

  let credentials
  if (credentialsJSON?.trim()) {
    try {
      credentials = JSON.parse(credentialsJSON)
    } catch {
      throw new Error(
        'The JSON credentials for this target are not valid JSON. Paste the whole contents of the service account key file.'
      )
    }
  }

  const storage = new Storage({
    ...(projectId ? { projectId } : {}),
    ...(credentials ? { credentials } : {}),
    ...(apiEndpoint ? { apiEndpoint } : {})
  })
  const handle = storage.bucket(bucket)
  buckets.set(target.id, { bucket: handle, fingerprint })
  return handle
}

/** Whether the service is telling us the object simply is not there. */
function isNotFound(err: any): boolean {
  return err?.code === 404
}

const gcsClient: ObjectStoreClient = {
  async put(target, key, data, contentType) {
    await bucketFor(target)
      .file(key)
      .save(data, {
        contentType,
        ...(target.config.storageClass && target.config.storageClass !== 'STANDARD'
          ? { metadata: { storageClass: target.config.storageClass } }
          : {})
      })
  },

  async get(target, key) {
    try {
      const [contents] = await bucketFor(target).file(key).download()
      return contents
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
    await bucketFor(target).file(key).delete({ ignoreNotFound: true })
  },

  async copy(target, fromKey, toKey) {
    const bucket = bucketFor(target)
    try {
      await bucket.file(fromKey).copy(bucket.file(toKey))
      return true
    } catch (err: any) {
      if (isNotFound(err)) {
        return false
      }
      throw err
    }
  },

  async presign(target, { key, expiresInSeconds, contentType, downloadAs }) {
    const baseUrl = signingBaseUrl(target)
    const [url] = await bucketFor(target)
      .file(key)
      .getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInSeconds * 1000,
        responseType: contentType,
        ...(downloadAs ? { promptSaveAs: downloadAs } : {}),
        /*
          A V4 signature covers the host, so a URL signed for `storage.googleapis.com` and then moved
          onto a custom domain is a signature for the wrong host. `cname` is how the client is told to
          sign for that domain in the first place — the same reason the S3 module builds a second
          client rather than rewriting its output.
        */
        ...(baseUrl ? { cname: baseUrl } : {})
      })
    return url
  }
}

/**
 * Google Cloud Storage module
 *
 * Object names are the same paths the disk target writes, under whatever `pathPrefix` this target
 * starts at, so a bucket and a folder hold the wiki's content laid out identically. See
 * `helpers/storageObjects.ts` for everything above the four calls below.
 */
export default objectStorageModule(gcsClient)
