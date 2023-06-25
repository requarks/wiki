import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { clone } from 'lodash-es'

import { useSiteStore } from './site'

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
    ignoreRouteChange: false
  }),
  getters: {
    hasPendingChanges: (state) => {
      return state.lastSaveTimestamp && state.lastSaveTimestamp !== state.lastChangeTimestamp
    }
  },
  actions: {
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
