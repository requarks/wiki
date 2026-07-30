import { defineStore } from 'pinia'

import { pick } from 'es-toolkit/object'

import { useSiteStore } from './site'
import { useEditorStore } from './editor'

/**
 * The icon a page starts with.
 *
 * An Iconify reference, so that the icon picker opens on its search tab with this one selected rather
 * than on the custom tab. Kept to a set seeded on every instance (`mdi`), so that it resolves without
 * an administrator having added anything.
 */
export const DEFAULT_PAGE_ICON = 'mdi:file-document-outline'

export const usePageStore = defineStore('page', {
  state: () => ({
    alias: '',
    allowComments: false,
    allowContributions: true,
    allowRatings: true,
    authorId: 0,
    authorName: '',
    commentsCount: 0,
    content: '',
    /**
     * Whether `content` above is this page's actual source, rather than just the state it starts in.
     *
     * The API leaves `content` out of a page unless an editor asked for it and the session may see it,
     * so an empty string in this store means either "the page is empty" or "nobody fetched it" — and
     * `pageSave` must not write the second one over a page that has content. See the guard there.
     */
    contentLoaded: false,
    createdAt: '',
    description: '',
    editor: '',
    icon: DEFAULT_PAGE_ICON,
    id: '',
    isBrowsable: true,
    /**
     * Whether the server withheld this page's body because it is password protected and this reader
     * has not entered the password. `render`, `toc` and `content` are empty while it is set — the API
     * never sent them — so nothing here can display a locked page by mistake.
     */
    isLocked: false,
    isSearchable: true,
    locale: 'en',
    navigationId: null,
    navigationMode: 'inherit',
    password: '',
    path: '',
    publishEndDate: '',
    publishStartDate: '',
    publishState: '',
    relations: [],
    render: '',
    scriptJsLoad: '',
    scriptJsUnload: '',
    scriptCss: '',
    showSidebar: true,
    showTags: true,
    showToc: true,
    tags: [],
    title: '',
    toc: [],
    tocDepth: {
      min: 1,
      max: 2
    },
    updatedAt: ''
  }),
  getters: {
    breadcrumbs: (state) => {
      const siteStore = useSiteStore()
      const pathPrefix = siteStore.useLocales ? `/${state.locale}` : ''
      return state.path.split('/').reduce((result, value, key) => {
        result.push({
          id: key,
          title: value,
          icon: 'la:file-alt',
          locale: 'en',
          path: (result.at(-1)?.path || pathPrefix) + `/${value}`
        })
        return result
      }, [])
    },
    folderPath: (state) => {
      return state.path.split('/').slice(0, -1).join('/')
    },
    isHome: (state) => {
      return ['', 'home'].includes(state.path)
    }
  },
  actions: {
    /**
     * PAGE - LOAD
     */
    async pageLoad({ path, id, withContent = false }) {
      const editorStore = useEditorStore()
      const siteStore = useSiteStore()
      /*
        The lock belongs to the page being loaded, not to the one before it.

        Everything else in this store stays put until the reply arrives, deliberately -- blanking it
        would flash an empty page on every navigation. `isLocked` cannot be treated that way: it is
        read as "the page on screen is protected", and left standing it makes the NEXT page look
        protected for as long as the request takes.
      */
      this.isLocked = false
      try {
        const pageData = await API_CLIENT.get(
          `sites/${siteStore.id}/pages/${id ?? fastHash(normalizePath(path))}`,
          {
            searchParams: {
              withContent
            }
          }
        ).json()
        if (!pageData?.id) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        // Update page store
        this.$patch({
          ...pageData,
          // -> The field is present exactly when the source came with the page, which is what makes
          //    the copy in this store safe to save; a view-mode load leaves the previous one in place
          contentLoaded: Object.hasOwn(pageData, 'content'),
          relations: pageData.relations.map((r) =>
            pick(r, ['id', 'position', 'label', 'caption', 'icon', 'target'])
          ),
          tocDepth: pick(pageData.tocDepth, ['min', 'max'])
        })
        // Update editor state timestamps
        const curDate = Temporal.Now.instant()
        editorStore.$patch({
          lastChangeTimestamp: curDate,
          lastSaveTimestamp: curDate
        })
      } catch (err) {
        // -> A missing page is an ordinary outcome, not a failure: it is what puts a new instance in
        //    front of the welcome screen, and what offers to create the page anywhere else
        if (err.response?.status === 404) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        console.warn(err)
        throw err
      }
    },
    /**
     * PAGE - UNLOCK
     *
     * Hands a password for a protected page to the server, which answers with the page — body
     * included — when it matches. The reply is what fills the content in, rather than this store
     * flipping `isLocked` and re-reading a page it already had: there is nothing here to unlock, the
     * body was never sent.
     *
     * The server also remembers the unlock for the session, so navigating away and back does not ask
     * again.
     *
     * @param {string} password
     * @throws When the password is wrong (401) or the request fails; the caller reports it.
     */
    async pageUnlock(password) {
      const siteStore = useSiteStore()
      const pageData = await API_CLIENT.post(`sites/${siteStore.id}/pages/${this.id}/unlock`, {
        json: { password }
      }).json()
      this.$patch({
        ...pageData,
        contentLoaded: Object.hasOwn(pageData, 'content'),
        relations: pageData.relations.map((r) =>
          pick(r, ['id', 'position', 'label', 'caption', 'icon', 'target'])
        ),
        tocDepth: pick(pageData.tocDepth, ['min', 'max'])
      })
    },
    /**
     * PAGE - GET PATH FROM ALIAS
     */
    async pageAlias(alias) {
      const siteStore = useSiteStore()
      try {
        const pagePath = await API_CLIENT.get(`sites/${siteStore.id}/pages/alias/${alias}`).json()
        if (!pagePath?.id) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        return pagePath.path
      } catch (err) {
        if (err.response?.status === 404) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        console.warn(err)
        throw err
      }
    },
    /**
     * PAGE - CREATE
     */
    async pageCreate({
      editor,
      locale,
      path,
      basePath,
      title = '',
      description = '',
      content = '',
      fromNavigate = false
    } = {}) {
      const editorStore = useEditorStore()

      // -> Load editor config
      if (!editorStore.configIsLoaded) {
        await editorStore.fetchConfigs()
      }

      // -> Path normalization
      if (path?.startsWith('/')) {
        path = path.substring(1)
      }
      if (basePath?.startsWith('/')) {
        basePath = basePath.substring(1)
      }
      if (basePath?.endsWith('/')) {
        basePath = basePath.substring(0, basePath.length - 1)
      }

      // -> Redirect if not at /_create path
      if (!this.router.currentRoute.value.path.startsWith('/_create/') && !fromNavigate) {
        editorStore.$patch({ ignoreRouteChange: true })
        this.router.push(`/_create/${editor}`)
      }

      // -> Init editor
      editorStore.$patch({
        originPageId: editorStore.isActive ? editorStore.originPageId : this.id, // Don't replace if already in edit mode
        isActive: true,
        mode: 'create',
        editor
      })

      // -> Default Page Path
      let newPath = path
      if (!path && path !== '') {
        const parentPath =
          basePath || basePath === '' ? basePath : this.path.split('/').slice(0, -1).join('/')
        newPath = parentPath ? `${parentPath}/new-page` : 'new-page'
      }

      // -> Set Default Page Data
      this.$patch({
        id: 0,
        locale: locale || this.locale,
        path: newPath,
        title: title ?? '',
        description: description ?? '',
        icon: DEFAULT_PAGE_ICON,
        alias: '',
        publishState: 'published',
        relations: [],
        tags: [],
        content: content ?? '',
        // -> A page being created has no stored source to lose: whatever it starts with IS the source
        contentLoaded: true,
        render: '',
        isBrowsable: true,
        isSearchable: true,
        mode: 'edit'
      })
    },
    /**
     * PAGE - DUPLICATE
     */
    async pageDuplicate({ sourecePageId, title, path }) {
      const siteStore = useSiteStore()
      try {
        const pageData = await API_CLIENT.get(
          `sites/${siteStore.id}/pages/${sourecePageId ?? this.id}`,
          { searchParams: { withContent: true } }
        ).json()
        if (!pageData?.id) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        this.pageCreate({
          editor: pageData.editor,
          title,
          path,
          content: pageData.content,
          description: pageData.description
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    /**
     * PAGE - EDIT
     */
    async pageEdit({ path, id, fromNavigate = false } = {}) {
      const editorStore = useEditorStore()

      const loadArgs = {
        withContent: true
      }

      if (id) {
        loadArgs.id = id
      } else if (path) {
        loadArgs.path = path
      } else {
        loadArgs.id = this.id
      }

      /*
        Edits made OUTSIDE the editor have to survive opening it.

        The page properties panel writes straight to this store, and the header then offers to save
        them — so a page can arrive here with a changed title and an unchanged everything else. A full
        load would replace every field with what is stored and reset the change timestamps, throwing
        those edits away without a word. The source is the only thing missing in that state, so the
        source is the only thing fetched.
      */
      if (editorStore.hasPendingChanges) {
        await this.pageLoadSource()
      } else {
        await this.pageLoad(loadArgs)
      }

      if (!editorStore.configIsLoaded) {
        await editorStore.fetchConfigs()
      }

      editorStore.$patch({
        isActive: true,
        mode: 'edit',
        editor: this.editor
      })
    },
    /**
     * PAGE - LOAD SOURCE ONLY
     *
     * Fetches the source and nothing else, for opening the editor on a page whose other fields have
     * already been edited elsewhere. Deliberately touches neither the rest of the page nor the editor's
     * change timestamps: what is pending stays pending, and stays saveable.
     */
    async pageLoadSource() {
      const siteStore = useSiteStore()
      try {
        const pageData = await API_CLIENT.get(`sites/${siteStore.id}/pages/${this.id}`, {
          searchParams: { withContent: true }
        }).json()
        // -> Absent rather than empty means the server withheld it; see `contentLoaded`
        if (!Object.hasOwn(pageData ?? {}, 'content')) {
          throw new Error('ERR_PAGE_SOURCE_UNAVAILABLE')
        }
        this.$patch({
          content: pageData.content,
          contentLoaded: true
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    /**
     * PAGE - MOVE
     */
    async pageMove({ id, title, path } = {}) {
      const siteStore = useSiteStore()
      unwrap(
        await API_CLIENT.put(`sites/${siteStore.id}/pages/${id}/path`, {
          json: {
            path,
            ...(title ? { title } : {})
          }
        }).json()
      )
      this.router.replace(`/${path}`)
    },
    /**
     * PAGE - Rename
     */
    async pageRename({ id, title } = {}) {
      const siteStore = useSiteStore()
      unwrap(
        await API_CLIENT.patch(`sites/${siteStore.id}/pages/${id}`, {
          json: { title }
        }).json()
      )

      // Update page store
      if (id === this.id) {
        this.$patch({ title })
      }
    },
    /**
     * PAGE SAVE
     */
    async pageSave() {
      const editorStore = useEditorStore()
      const siteStore = useSiteStore()
      try {
        // -> The render goes up with the content: the markdown pipeline runs here, in the editor, and
        //    what the preview shows is what gets stored. The server post-processes it — sanitizing it
        //    against what this author may embed, and deriving the table of contents — so the page it
        //    returns is the authority on what was actually saved.
        const body = {
          ...pick(this, [
            'alias',
            'allowComments',
            'allowContributions',
            'allowRatings',
            'content',
            'description',
            'icon',
            'isBrowsable',
            'isSearchable',
            'password',
            'publishEndDate',
            'publishStartDate',
            'publishState',
            'relations',
            'render',
            'scriptJsLoad',
            'scriptJsUnload',
            'scriptCss',
            'showSidebar',
            'showTags',
            'showToc',
            'tags',
            'title',
            'tocDepth'
          ])
        }

        /*
          Never save a source this store never received.

          An editor that came up empty because the source was withheld — an expired session, a failed
          load — is indistinguishable from an empty page by the time the payload is built, and sending
          the empty string replaces the stored HTML's source with nothing. Dropping the key instead
          leaves it exactly as it was: `updatePage` only writes `content` when it is not `undefined`.

          Typing into an editor sets the flag, so deliberately clearing a page still works — that empty
          string came from the author, not from a load that never happened. A page being created always
          has it set, which is also why this cannot leave the POST short of a required field.
        */
        if (!this.contentLoaded) {
          delete body.content
          console.warn('Page source was never loaded; saving without touching the stored content.')
        }

        let pageData
        if (editorStore.mode === 'create') {
          const resp = unwrap(
            await API_CLIENT.post(`sites/${siteStore.id}/pages`, {
              json: {
                ...body,
                locale: this.locale,
                path: this.path,
                editor: editorStore.editor
              }
            }).json()
          )
          pageData = resp?.page
          if (!pageData?.id) {
            throw new Error('ERR_CREATED_PAGE_NOT_FOUND')
          }
        } else {
          const resp = unwrap(
            await API_CLIENT.patch(`sites/${siteStore.id}/pages/${this.id}`, {
              json: body
            }).json()
          )
          pageData = resp?.page
          if (!pageData?.id) {
            throw new Error('ERR_PAGE_NOT_FOUND')
          }
        }

        // Update page store
        this.$patch({
          ...pageData,
          relations: (pageData.relations ?? []).map((r) =>
            pick(r, ['id', 'position', 'label', 'caption', 'icon', 'target'])
          ),
          tocDepth: pick(pageData.tocDepth, ['min', 'max'])
        })

        if (editorStore.mode === 'create') {
          editorStore.$patch({ mode: 'edit' })
          this.router.replace(`/${this.path}`)
        }

        // Update editor state timestamps
        const curDate = Temporal.Now.instant()
        editorStore.$patch({
          lastChangeTimestamp: curDate,
          lastSaveTimestamp: curDate,
          reasonForChange: ''
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    async cancelPageEdit() {
      const editorStore = useEditorStore()
      await this.pageLoad({ id: editorStore.originPageId ? editorStore.originPageId : this.id })
      this.router.replace(`/${this.path}`)
    },
    generateToc() {}
  }
})

/**
 * Turn a refused request back into an error.
 *
 * The API client is set up not to throw on 400 (see `boot/api.js`), so a rejected save arrives as a
 * parsed error envelope rather than an exception — and reading it as a success is how a validation
 * failure ends up reported as something unrelated.
 */
function unwrap(resp) {
  if (resp?.ok === false) {
    throw new Error(resp.message || 'An unexpected error occured.')
  }
  return resp
}

/**
 * Reduce a route path to the form the server stores a page under.
 *
 * A page is looked up by the hash of its path, so the two sides have to agree on what the path *is*
 * before hashing it: the router hands over `/docs/intro`, the server holds `docs/intro`, and the site
 * root is the `home` page rather than an empty path.
 */
function normalizePath(path) {
  const clean = (path ?? '').replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase()
  return clean || 'home'
}

/**
 * Fast, non-cryptographic 53-bit hash to encode page paths.
 * Returns a URL-safe hex string.
 *
 * Mirrored on the server as `generatePathHash` in `backend/helpers/common.ts` — the two have to stay
 * identical, since this is what a page is addressed by.
 */
function fastHash(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  // Convert to a 16-character hexadecimal string
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}
