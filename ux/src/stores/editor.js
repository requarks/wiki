import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { clone } from 'lodash-es'
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
    async fetchConfigs () {
      const siteStore = useSiteStore()
      try {
        if (!siteStore.id) {
          throw new Error('Cannot fetch editors config: Missing Site ID')
        }
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query fetchEditorConfigs (
              $id: UUID!
            ) {
              siteById(
                id: $id
              ) {
                id
                editors {
                  asciidoc {
                    isActive
                    config
                  }
                  markdown {
                    isActive
                    config
                  }
                  wysiwyg {
                    isActive
                    config
                  }
                }
              }
            }
          `,
          variables: {
            id: siteStore.id
          },
          fetchPolicy: 'network-only'
        })
        this.$patch({
          editors: {
            asciidoc: resp?.data?.siteById?.editors?.asciidoc?.config,
            markdown: resp?.data?.siteById?.editors?.markdown?.config,
            wysiwyg: resp?.data?.siteById?.editors?.wysiwyg?.config
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
