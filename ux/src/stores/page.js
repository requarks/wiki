import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { cloneDeep, last, transform } from 'lodash-es'

import { useSiteStore } from './site'

export const usePageStore = defineStore('page', {
  state: () => ({
    isLoading: true,
    mode: 'view',
    editor: 'wysiwyg',
    editorMode: 'edit',
    id: 0,
    authorId: 0,
    authorName: '',
    createdAt: '',
    description: '',
    isPublished: true,
    showInTree: true,
    locale: 'en',
    path: '',
    publishEndDate: '',
    publishStartDate: '',
    tags: [],
    title: '',
    icon: 'las la-file-alt',
    updatedAt: '',
    relations: [],
    scriptJsLoad: '',
    scriptJsUnload: '',
    scriptStyles: '',
    allowComments: false,
    allowContributions: true,
    allowRatings: true,
    showSidebar: true,
    showToc: true,
    showTags: true,
    tocDepth: {
      min: 1,
      max: 2
    },
    breadcrumbs: [
      // {
      //   id: 1,
      //   title: 'Installation',
      //   icon: 'las la-file-alt',
      //   locale: 'en',
      //   path: 'installation'
      // },
      // {
      //   id: 2,
      //   title: 'Ubuntu',
      //   icon: 'lab la-ubuntu',
      //   locale: 'en',
      //   path: 'installation/ubuntu'
      // }
    ],
    effectivePermissions: {
      comments: {
        read: false,
        write: false,
        manage: false
      },
      history: {
        read: false
      },
      source: {
        read: false
      },
      pages: {
        write: false,
        manage: false,
        delete: false,
        script: false,
        style: false
      },
      system: {
        manage: false
      }
    },
    commentsCount: 0,
    content: '',
    render: '',
    toc: []
  }),
  getters: {},
  actions: {
    /**
     * PAGE - LOAD
     */
    async pageLoad ({ path, id }) {
      const siteStore = useSiteStore()
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query loadPage (
              $siteId: UUID!
              $path: String!
            ) {
              pageByPath(
                siteId: $siteId
                path: $path
              ) {
                id
                title
                description
                path
                locale
                updatedAt
                render
                toc
              }
            }
          `,
          variables: {
            siteId: siteStore.id,
            path
          },
          fetchPolicy: 'network-only'
        })
        const pageData = cloneDeep(resp?.data?.pageByPath ?? {})
        if (!pageData?.id) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        const pathPrefix = siteStore.useLocales ? `/${pageData.locale}` : ''
        this.$patch({
          ...pageData,
          breadcrumbs: transform(pageData.path.split('/'), (result, value, key) => {
            result.push({
              id: key,
              title: value,
              icon: 'las la-file-alt',
              locale: 'en',
              path: (last(result)?.path || pathPrefix) + `/${value}`
            })
          }, [])
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    /**
     * PAGE - CREATE
     */
    pageCreate ({ editor, locale, path }) {
      // -> Editor View
      this.editor = editor
      this.editorMode = 'create'

      // if (['markdown', 'api'].includes(editor)) {
      //   commit('site/SET_SHOW_SIDE_NAV', false, { root: true })
      // } else {
      //   commit('site/SET_SHOW_SIDE_NAV', true, { root: true })
      // }

      // if (['markdown', 'channel', 'api'].includes(editor)) {
      //   commit('site/SET_SHOW_SIDEBAR', false, { root: true })
      // } else {
      //   commit('site/SET_SHOW_SIDEBAR', true, { root: true })
      // }

      // -> Page Data
      this.id = 0
      this.locale = locale || this.locale
      if (path) {
        this.path = path
      } else {
        this.path = this.path.length < 2 ? 'new-page' : `${this.path}/new-page`
      }
      this.title = ''
      this.description = ''
      this.icon = 'las la-file-alt'
      this.isPublished = false
      this.relations = []
      this.tags = []
      this.breadcrumbs = []

      this.content = ''
      this.render = ''

      // -> View Mode
      this.mode = 'edit'
    },
    generateToc () {

    }
  }
})
