import { Readable } from 'node:stream'
import { normalizePagePath } from '../../helpers/common.ts'
import { callApi } from '../inject.ts'
import { mayOnPage } from '../context.ts'
import { activeLocales, primaryLocale, toIso } from '../content.ts'
import { jsonResult, ToolError } from '../tool.ts'
import type { McpContext } from '../context.ts'
import type { McpTool, ToolResult } from '../tool.ts'
import type { Asset } from '../../models/assets.ts'

/**
 * Uploaded files: list them, look at one, add one.
 *
 * Off by default (`mcp.tools.assets`): binary content in a context window is expensive, and an upload
 * is the one write that is not text a person can read in a diff. Read through the models, as the
 * asset routes read; written through the upload route in-process, since its checks — `write:assets`
 * at the destination, the reserved page extensions, the site's upload conflict behaviour — live
 * there.
 */

/** The image types a model can be shown, which is what MCP image content is for. */
const VIEWABLE_IMAGES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

/** The largest image handed over as an image — base64 grows it by a third, inside a context window. */
const MAX_IMAGE_BYTES = 1024 * 1024

/** The largest file `upload_asset` takes, decoded — kept well inside the endpoint's body limit. */
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024

/** Types whose bytes are text a model can read as it is. */
function isTextual(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    ['application/json', 'application/xml', 'application/x-yaml', 'image/svg+xml'].includes(
      mimeType
    )
  )
}

/** `read:assets` on the file's own path, as `mayOnAsset` in `api/assets.ts` asks it. */
function mayReadAsset(
  ctx: McpContext,
  asset: { folderPath?: string | null; fileName: string; locale: string }
) {
  const folder = asset.folderPath ?? ''
  return mayOnPage(ctx, 'read:assets', {
    siteId: ctx.siteId,
    path: folder ? `${folder}/${asset.fileName}` : asset.fileName,
    locale: asset.locale
  })
}

/** Where a page links to the file: `/_files/<folder>/<name>`, as content does. */
function fileUrl(ctx: McpContext, asset: { folderPath?: string | null; fileName: string }): string {
  const path = [asset.folderPath, asset.fileName].filter(Boolean).join('/')
  return `${ctx.origin}/_files/${encodeURI(path)}`
}

function assetFields(ctx: McpContext, asset: Asset) {
  return {
    id: asset.id,
    fileName: asset.fileName,
    path: [asset.folderPath, asset.fileName].filter(Boolean).join('/'),
    url: fileUrl(ctx, asset),
    link: `/_files/${[asset.folderPath, asset.fileName].filter(Boolean).join('/')}`,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    ...(asset.width && asset.height ? { width: asset.width, height: asset.height } : {}),
    updatedAt: toIso(asset.updatedAt)
  }
}

async function bytesOf(body: Readable | Buffer, limit: number): Promise<Buffer | null> {
  if (Buffer.isBuffer(body)) {
    return body.length > limit ? null : body
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of body) {
    size += chunk.length
    if (size > limit) {
      body.destroy()
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

const listAssets: McpTool<{ folder?: string; locale?: string }> = {
  name: 'list_assets',
  title: 'List files',
  description:
    'The uploaded files in one folder of the wiki — images, documents, attachments — with their type, size and the link a page uses for each, and the sub-folders to look in next. The site root when `folder` is absent.',
  group: 'assets',
  category: 'assets',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      folder: { type: 'string', maxLength: 2048, description: 'e.g. `guides/setup`.' },
      locale: { type: 'string', maxLength: 10 }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const locale = args.locale || primaryLocale(ctx)
    if (!activeLocales(ctx).includes(locale)) {
      throw new ToolError(`${locale} is not an active locale on this site.`)
    }
    const folder = normalizePagePath(args.folder)
    const items = await WIKI.models.tree.getTree({
      siteId: ctx.siteId,
      parentPath: folder,
      locale,
      types: ['folder', 'asset'],
      limit: 500
    })
    const assets = []
    const folders = []
    for (const item of items) {
      const path = item.folderPath ? `${item.folderPath}/${item.fileName}` : item.fileName
      if (item.type === 'folder') {
        // -> A folder is judged on its own path, as the tree route judges one
        if (mayOnPage(ctx, 'read:pages', { siteId: ctx.siteId, path, locale })) {
          folders.push({ path, title: item.title })
        }
      } else if (
        mayReadAsset(ctx, { folderPath: item.folderPath, fileName: item.fileName, locale })
      ) {
        assets.push({
          id: item.id,
          fileName: item.fileName,
          path,
          link: `/_files/${path}`,
          mimeType: item.mimeType,
          fileSize: item.fileSize,
          ...(item.width && item.height ? { width: item.width, height: item.height } : {})
        })
      }
    }
    return jsonResult({ locale, folder, folders, assets })
  }
}

const getAsset: McpTool<{ id?: string; path?: string }> = {
  name: 'get_asset',
  title: 'Look at a file',
  description:
    "One uploaded file: its details, and its content where a model can use it — a PNG, JPEG, GIF or WebP image up to 1 MB as an image, a text file (markdown, CSV, JSON, SVG…) as text. Anything else comes back as details and a link. Name it by `id` or by `path` (as in a page's /_files/ link, without the prefix).",
  group: 'assets',
  category: 'assets',
  readOnly: true,
  idempotent: true,
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      path: { type: 'string', maxLength: 2048, description: 'e.g. `guides/setup/diagram.png`.' }
    },
    additionalProperties: false
  },
  async run(ctx, args) {
    const path = args.path?.replace(/^\/?(_files\/)?/, '')
    const asset = args.id
      ? await WIKI.models.assets.getAsset(ctx.siteId, args.id)
      : path
        ? await WIKI.models.assets.getAssetByPath(ctx.siteId, path)
        : null
    if (!args.id && !path) {
      throw new ToolError('Name the file with `id` or `path`.')
    }
    // -> Not readable is answered as not there, as the asset routes answer it
    if (!asset || !mayReadAsset(ctx, asset)) {
      throw new ToolError('There is no file there that you may read.')
    }
    const fields = assetFields(ctx, asset)
    const viewable = VIEWABLE_IMAGES.has(asset.mimeType) && asset.fileSize <= MAX_IMAGE_BYTES
    const cap = WIKI.models.mcp.getConfig().maxResultChars
    const readable = isTextual(asset.mimeType) && asset.fileSize <= cap
    if (!viewable && !readable) {
      return jsonResult({
        ...fields,
        note: 'The content is not something to show here: link the file by its `link`.'
      })
    }
    const content = await WIKI.models.assets.readContent(asset)
    const bytes = content ? await bytesOf(content.body, viewable ? MAX_IMAGE_BYTES : cap) : null
    if (!bytes) {
      return jsonResult({ ...fields, note: 'The content could not be read.' })
    }
    const result: ToolResult = {
      content: [
        { type: 'text', text: JSON.stringify(fields, null, 2) },
        viewable
          ? { type: 'image', data: bytes.toString('base64'), mimeType: asset.mimeType }
          : { type: 'text', text: bytes.toString('utf8') }
      ]
    }
    return result
  }
}

const uploadAsset: McpTool<{
  folder?: string
  fileName: string
  mimeType: string
  base64?: string
  text?: string
  locale?: string
}> = {
  name: 'upload_asset',
  title: 'Upload a file',
  description:
    'Uploads a file for a page to use — a screenshot, an attachment — into the folder of the page that will link it. Send the bytes as `base64`, or `text` for a text file. At most 3 MB. The answer gives the `link` to put in the page (the stored name may differ from the one sent). A diagram is better written in the page as a ```mermaid code block, which stays text a person can review, than uploaded as a picture.',
  group: 'assets',
  category: 'assets',
  readOnly: false,
  inputSchema: {
    type: 'object',
    properties: {
      folder: {
        type: 'string',
        maxLength: 2048,
        description: 'e.g. `guides/setup`. The site root when absent.'
      },
      fileName: { type: 'string', minLength: 1, maxLength: 255 },
      mimeType: { type: 'string', minLength: 3, maxLength: 255, description: 'e.g. `image/png`.' },
      base64: { type: 'string', maxLength: 4194304 },
      text: { type: 'string', maxLength: 3145728 },
      locale: { type: 'string', maxLength: 10 }
    },
    required: ['fileName', 'mimeType'],
    additionalProperties: false
  },
  async run(ctx, args) {
    if ((args.base64 === undefined) === (args.text === undefined)) {
      throw new ToolError('Send the file as either `base64` or `text`.')
    }
    const data =
      args.base64 !== undefined
        ? Buffer.from(args.base64, 'base64')
        : Buffer.from(args.text!, 'utf8')
    if (data.length < 1) {
      throw new ToolError('The file is empty.')
    }
    if (data.length > MAX_UPLOAD_BYTES) {
      throw new ToolError('The file is larger than 3 MB.')
    }
    const result = await callApi(ctx, 'POST', `sites/${ctx.siteId}/assets`, {
      query: {
        fileName: args.fileName,
        ...(args.folder ? { folderPath: normalizePagePath(args.folder) } : {}),
        ...(args.locale ? { locale: args.locale } : {})
      },
      raw: { data, contentType: args.mimeType }
    })
    const asset = result?.asset as Asset | undefined
    if (!asset) {
      throw new ToolError('The upload was not stored.')
    }
    return jsonResult(assetFields(ctx, asset))
  }
}

export const assetTools: McpTool[] = [listAssets, getAsset, uploadAsset]
