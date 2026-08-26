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
    pendingAssets: []
  }),
  getters: {
    hasPendingChanges: (state) => {
      return state.lastSaveTimestamp && state.lastSaveTimestamp !== state.lastChangeTimestamp
    }
  },
  actions: {
    addPendingAsset (data) {
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
          file: new File(data, fileName, { type: data.type }),
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
    clearPendingAssets () {
      for (const item of this.pendingAssets) {
        URL.revokeObjectURL(item.blobUrl)
      }
      this.pendingAssets = []
    },
    async fetchConfigs () {
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
            markdown: siteInfo?.editors?.markdown?.config ?? {},
            wysiwyg: siteInfo?.editors?.wysiwyg?.config ?? {}
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
