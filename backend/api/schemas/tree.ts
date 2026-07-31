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
   * BROWSE ITEM - One entry of a reader's folder listing, which may be a page and a folder at once
   */
  app.addSchema({
    $id: 'BrowseItem',
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description:
          "Slash-separated path of the entry: the page's own URL, and the folder to list on the way down."
      },
      fileName: {
        type: 'string'
      },
      title: {
        type: 'string',
        description: "The page's title when there is a page here, otherwise the folder's."
      },
      icon: {
        type: ['string', 'null'],
        description:
          "The page's icon, as an Iconify reference. Null for a folder with no page at its path."
      },
      isPage: {
        type: 'boolean',
        description: 'Whether there is a page at this path to open.'
      },
      isFolder: {
        type: 'boolean',
        description: 'Whether there is a folder at this path to descend into.'
      }
    }
  })

  /**
   * LISTED PAGE - One page of a reader-facing listing, as an index block draws it
   */
  app.addSchema({
    $id: 'ListedPage',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid'
      },
      path: {
        type: 'string',
        description: 'Slash-separated path of the page, i.e. its URL within the site.'
      },
      title: {
        type: 'string'
      },
      description: {
        type: 'string'
      },
      icon: {
        type: 'string',
        description: "The page's icon, as an Iconify reference. Empty when it has none."
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
