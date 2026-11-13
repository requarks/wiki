import { isNoteImagesPath } from './common.ts'
import { requestUserId } from './requester.ts'
import type { FastifyRequest } from 'fastify'

/**
 * Whether a request may read an asset's bytes — the file itself under `/_files`, or its thumbnail
 * under `/_thumb`. The two answer the same question, so they ask it here.
 *
 * A live note's image is not judged by the page rules for its path, which nobody writes for its
 * folder and which answer no there regardless of what they say (`checkAccess`). It is the note's own
 * footing instead: anybody who may read the site's live notes -- a guest, where the guests group
 * holds `read:notes` -- and holds the URL, its random name being what nobody can guess. Everything
 * else is `read:assets` on the file's path.
 */
export function mayReadAsset(
  req: FastifyRequest,
  siteId: string,
  asset: { folderPath: string | null; fileName: string; locale: string }
): boolean {
  if (isNoteImagesPath(asset.folderPath)) {
    return WIKI.models.liveNotes.permissionsFor(
      {
        userId: requestUserId(req),
        actor: WIKI.models.groups.actorForRequest(req)
      },
      siteId
    ).read
  }
  return WIKI.models.groups.checkAccess(WIKI.models.groups.actorForRequest(req), 'read:assets', {
    siteId,
    path: asset.folderPath ? `${asset.folderPath}/${asset.fileName}` : asset.fileName,
    locale: asset.locale
  })
}
