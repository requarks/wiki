import {
  BlobSASPermissions,
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters
} from '@azure/storage-blob'
import { DefaultAzureCredential } from '@azure/identity'
import { objectStorageModule, signingBaseUrl } from '../../../helpers/storageObjects.ts'
import type { ContainerClient } from '@azure/storage-blob'
import type { ObjectStoreClient } from '../../../helpers/storageObjects.ts'
import type { StorageTarget } from '../../../models/storage.ts'

/** Live container clients, keyed by target, plus whether the container has been ensured. */
const containers = new Map<string, { container: ContainerClient; fingerprint: string }>()

/** The settings a client is built from — a change to any of them needs a new one. */
function configFingerprint(target: StorageTarget): string {
  const c = target.config
  return JSON.stringify([c.accountName, c.accountKey, c.containerName])
}

/**
 * The container client for this target, created once and kept.
 *
 * The container is created on the way, which is the one place these three modules differ in what they
 * will do for you: a container is namespaced under the storage account and costs nothing to make,
 * whereas an S3 bucket is a global name and a GCS bucket is billable, so both of those are the
 * administrator's to create.
 *
 * **The account key is optional.** Left empty, `DefaultAzureCredential` is used instead — a managed
 * identity on an Azure VM or container app, or the standard `AZURE_*` environment variables — which is
 * how a deployment avoids putting a long-lived key in the database at all.
 */
async function containerFor(target: StorageTarget): Promise<ContainerClient> {
  const fingerprint = configFingerprint(target)
  const cached = containers.get(target.id)
  if (cached && cached.fingerprint === fingerprint) {
    return cached.container
  }
  const { accountName, accountKey, containerName } = target.config
  const url = `https://${accountName}.blob.core.windows.net`
  const service = accountKey
    ? new BlobServiceClient(url, new StorageSharedKeyCredential(accountName, accountKey))
    : new BlobServiceClient(url, new DefaultAzureCredential())
  const container = service.getContainerClient(containerName || 'wiki')
  await container.createIfNotExists()
  containers.set(target.id, { container, fingerprint })
  return container
}

/**
 * A user delegation key, for an account authenticating as itself rather than with a shared key.
 *
 * The managed-identity path: with no account key there is nothing to sign a SAS with, so Azure is
 * asked for a short-lived key to sign with instead. It needs the **Storage Blob Delegator** role on
 * the account, and it is what makes direct access work without a long-lived secret in the database.
 *
 * Cached until shortly before it expires, since fetching one is a round trip and every image on every
 * page would otherwise pay for it.
 */
const delegationKeys = new Map<string, { key: any; expiresAt: number }>()

/** How long a delegation key is asked for, and how much of that is left unused as a safety margin. */
const DELEGATION_KEY_MINUTES = 60
const DELEGATION_KEY_MARGIN_MS = 5 * 60_000

async function delegationKeyFor(target: StorageTarget): Promise<any> {
  const cached = delegationKeys.get(target.id)
  const now = Date.now()
  if (cached && cached.expiresAt - DELEGATION_KEY_MARGIN_MS > now) {
    return cached.key
  }
  const service = new BlobServiceClient(
    `https://${target.config.accountName}.blob.core.windows.net`,
    new DefaultAzureCredential()
  )
  const expiresAt = now + DELEGATION_KEY_MINUTES * 60_000
  const key = await service.getUserDelegationKey(new Date(now), new Date(expiresAt))
  delegationKeys.set(target.id, { key, expiresAt })
  return key
}

/** Whether the service is telling us the blob simply is not there. */
function isNotFound(err: any): boolean {
  return err?.statusCode === 404 || err?.details?.errorCode === 'BlobNotFound'
}

const azureClient: ObjectStoreClient = {
  async put(target, key, data, contentType) {
    const blob = (await containerFor(target)).getBlockBlobClient(key)
    await blob.uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
      ...(target.config.accessTier ? { tier: target.config.accessTier } : {})
    })
  },

  async get(target, key) {
    try {
      return await (await containerFor(target)).getBlockBlobClient(key).downloadToBuffer()
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
    await (await containerFor(target)).getBlockBlobClient(key).deleteIfExists()
  },

  async copy(target, fromKey, toKey) {
    const container = await containerFor(target)
    const source = container.getBlockBlobClient(fromKey)
    if (!(await source.exists())) {
      return false
    }
    // -> Server-side, and awaited: the destination has to be complete before the caller deletes the
    //    source, and `beginCopyFromURL` is only a promise that the copy has *started*
    const copy = await container.getBlockBlobClient(toKey).beginCopyFromURL(source.url)
    await copy.pollUntilDone()
    return true
  },

  async presign(target, { key, expiresInSeconds, contentType, downloadAs }) {
    const { accountName, accountKey, containerName } = target.config
    const container = containerName || 'wiki'
    const now = Date.now()
    const values = {
      containerName: container,
      blobName: key,
      permissions: BlobSASPermissions.parse('r'),
      // -> A minute of slack at the front, because the reader's clock and Azure's need not agree and
      //    a SAS that is not valid yet fails exactly as hard as one that has expired
      startsOn: new Date(now - 60_000),
      expiresOn: new Date(now + expiresInSeconds * 1000),
      contentType,
      ...(downloadAs
        ? { contentDisposition: `attachment; filename="${encodeURIComponent(downloadAs)}"` }
        : {})
    }

    const sas = accountKey
      ? generateBlobSASQueryParameters(
          values,
          new StorageSharedKeyCredential(accountName, accountKey)
        )
      : generateBlobSASQueryParameters(values, await delegationKeyFor(target), accountName)

    /*
      Azure signs the canonicalized resource — the account, the container and the blob — and not the
      host, which is the one thing that makes this simpler than S3 and GCS: a CDN or Front Door
      endpoint in front of the container can be put in front of a signature made for the account, and
      Azure still validates it when the request reaches the origin.
    */
    const base = signingBaseUrl(target)
    const origin = base ?? `https://${accountName}.blob.core.windows.net/${container}`
    return `${origin}/${key.split('/').map(encodeURIComponent).join('/')}?${sas.toString()}`
  }
}

/**
 * Azure Blob Storage module
 *
 * Blob names are the same paths the disk target writes, so a container and a folder hold the wiki's
 * content laid out identically, and the shape of both is the site's `pathPrefixFor` to decide. See
 * `helpers/storageObjects.ts` for everything above the four calls below.
 */
export default objectStorageModule(azureClient)
