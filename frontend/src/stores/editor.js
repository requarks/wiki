import { defineStore } from 'pinia'

import { v4 as uuid } from 'uuid'

import { useSiteStore } from './site'

const imgMimeExt = {
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/tiff': 'tif'
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    isActive: false,
    editor: '',
    originPageId: '',
    mode: 'edit',
    activeModal: '',
    activeModalData: null,
    hideSideNav: false,
    media: {
      folderTree: [],
      currentFolderId: 0,
      currentFileId: null
    },
    checkoutDateActive: '',
    lastSaveTimestamp: null,
    lastChangeTimestamp: null,
    editors: {},
    configIsLoaded: false,
    reasonForChange: '',
    ignoreRouteChange: false,
    pendingAssets: [],
    /**
     * Whether the open editor holds its document and can take an edit from outside -- mounted, and
     * past the wait for a collaborative room. Until then a document put into it is overwritten: the
     * room's binding replaces whatever the editor was holding. Set by the editor itself, since only it
     * knows when that is; see `restoreEditorContent` in each one and `composables/editorBuffer.js`.
     */
    isReady: false
  }),
  getters: {
    hasPendingChanges: (state) => {
      return state.lastSaveTimestamp && state.lastSaveTimestamp !== state.lastChangeTimestamp
    },
    /**
     * Whether something was changed that has not been saved -- `hasPendingChanges`, and a page being
     * created as well. That one never had a save, so `lastSaveTimestamp` is null there when the app
     * was opened straight onto the create route, and `hasPendingChanges` says no however much has
     * been written. Not tied to the editor being open: the moment it closes is exactly when this is
     * asked, by the buffer deciding what to keep.
     */
    hasUnsavedEdits: (state) => {
      return (
        Boolean(state.lastChangeTimestamp) && state.lastChangeTimestamp !== state.lastSaveTimestamp
      )
    }
  },
  actions: {
    /**
     * The editor is no longer open.
     *
     * One place rather than a `$patch` at each exit, because "closed" is four fields and every site
     * that wrote its own got a different subset of them -- leaving a mode of `create` behind after a
     * new page was abandoned, or an `originPageId` naming the page somebody was reading when they
     * started writing one, weeks of navigation ago. Both are read by the next editing session and
     * neither is obviously stale when it is.
     *
     * `mode` goes back to `edit` rather than to nothing: it describes the editor that is open and
     * there is none, so the value that matters is what the NEXT one inherits -- and an editor opened
     * on a page that exists is an edit.
     */
    closeEditor() {
      this.$patch({
        isActive: false,
        isReady: false,
        editor: '',
        mode: 'edit',
        // -> Only ever meaningful while a page is being created: it is where Discard goes back to
        originPageId: ''
      })
    },
    /**
     * Say that nothing is unsaved any more, because what was has just been saved or thrown away.
     *
     * The same instant in both, which is how "no pending changes" is spelled. Done BEFORE anything
     * navigates away from the editor: the router's guard asks about unsaved edits on the way out, and
     * the browser buffer keeps whatever is still unsaved when the editor closes.
     */
    settleChanges() {
      const now = Temporal.Now.instant()
      this.$patch({ lastChangeTimestamp: now, lastSaveTimestamp: now })
    },
    /**
     * Take a file the author has just put into a page, to be uploaded when the page is saved.
     *
     * @param {File|Blob} data A `File` keeps the name it arrived with; a `Blob` is given one, since
     *   it has none and only its media type to name it by.
     * @returns {string} A `blob:` URL to write into the content, which the upload rewrites to a
     *   stored path — see `UploadPendingAssetsDialog`.
     */
    addPendingAsset(data) {
      const blobUrl = URL.createObjectURL(data)
      if (data instanceof File) {
        this.pendingAssets.push({
          id: uuid(),
          kind: 'file',
          file: data,
          fileName: data.name,
          blobUrl
        })
      } else {
        const fileId = uuid()
        const fileName = `${fileId}.${imgMimeExt[data.type] || 'dat'}`
        this.pendingAssets.push({
          id: fileId,
          kind: 'blob',
          // -> `[data]`, because the constructor takes the PARTS of a file rather than a file: a bare
          //    blob is not iterable and throws. Nothing reached this branch until the drawing editor
          //    did -- a paste and a drop both arrive as a `File`, so every other caller takes the
          //    branch above, and an image out of an Excalidraw scene is the first that is only a blob
          file: new File([data], fileName, { type: data.type }),
          fileName,
          blobUrl
        })
      }
      return blobUrl
    },
    /**
     * Drop every pending asset without uploading any of them.
     *
     * What the end of an editing session that did not save means for these. A pending asset becomes a
     * file only when the page is SAVED, so once the editor is gone nothing is ever going to send them,
     * and nothing points at them either -- the markdown that did went with the draft that was
     * discarded.
     *
     * Left in place they outlive the editor that made them and are uploaded by the next save instead,
     * which is very often another page: a file filed into that page's folder that nothing references,
     * and one nobody chose to upload. `pendingAssets` is not per page, and the rail that lists them is
     * only drawn while an editor is open, so a leftover is also invisible until it lands.
     *
     * Revokes the URLs on the way out, since the browser holds the bytes behind each one until it is
     * told it can let go.
     */
    clearPendingAssets() {
      for (const item of this.pendingAssets) {
        URL.revokeObjectURL(item.blobUrl)
      }
      this.pendingAssets = []
    },
    async fetchConfigs() {
      const siteStore = useSiteStore()
      try {
        if (!siteStore.id) {
          throw new Error('Cannot fetch editors config: Missing Site ID')
        }
        // -> The editor configs are part of the site config, which is one request rather than a
        //    dedicated endpoint
        const siteInfo = await API_CLIENT.get(`sites/${siteStore.id}`).json()
        this.$patch({
          editors: {
            asciidoc: siteInfo?.editors?.asciidoc?.config ?? {},
            markdown: siteInfo?.editors?.markdown?.config ?? {}
          },
          configIsLoaded: true
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    }
  }
})
