import type { FastifyInstance } from 'fastify'

export async function registerSchemas(app: FastifyInstance): Promise<void> {
  /**
   * TREE ITEM - One entry of a folder listing, whichever of the three kinds it is
   */
  app.addSchema({
    $id: 'TreeItem',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      type: {
        type: 'string',
        enum: ['folder', 'page', 'asset']
      },
      depth: {
        type: 'integer',
        description: 'How many folders deep the entry sits, 0 being the site root.'
      },
      folderPath: {
        type: 'string',
        description: 'Slash-separated, without a leading or trailing slash. Empty at the site root.'
      },
      fileName: {
        type: 'string'
      },
      title: {
        type: 'string'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string'
        }
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      },
      childrenCount: {
        type: 'integer',
        description: 'Folders only — how many entries the folder holds.'
      },
      isAncestor: {
        type: 'boolean',
        description:
          'Folders only — true when the folder sits above the one being listed, i.e. it came from `includeAncestors` or `includeRootFolders` rather than from the listing itself.'
      },
      fileSize: {
        type: 'integer',
        description: 'Assets only — in bytes.'
      },
      fileExt: {
        type: 'string',
        description: 'Assets only — lowercase, without the dot.'
      },
      mimeType: {
        type: 'string',
        description: 'Assets only.'
      },
      editor: {
        type: 'string',
        description: 'Pages only.'
      },
      description: {
        type: 'string',
        description: 'Pages only.'
      }
    }
  })

  /**
   * FOLDER INPUT - The writable fields of a folder, used for both create and rename
   */
  app.addSchema({
    $id: 'FolderInput',
    type: 'object',
    properties: {
      pathName: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: '^[a-z0-9-]+$',
        description: "The folder's own path segment, as it appears in a URL."
      },
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        description: 'What the folder is called when it is shown to a reader.'
      }
    }
  })

  /**
   * FOLDER - A folder, as returned after creating or renaming one
   */
  app.addSchema({
    $id: 'Folder',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      folderPath: {
        type: 'string',
        description: 'Slash-separated path of the folder holding this one. Empty at the site root.'
      },
      fileName: {
        type: 'string'
      },
      title: {
        type: 'string'
      },
      locale: {
        type: 'string'
      },
      childrenCount: {
        type: 'integer'
      },
      createdAt: {
        type: 'string',
        format: 'date-time'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time'
      }
    }
  })
}
