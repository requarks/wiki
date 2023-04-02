import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { cloneDeep, initial, last, pick, transform } from 'lodash-es'
import { DateTime } from 'luxon'

import { useSiteStore } from './site'
import { useEditorStore } from './editor'

const pagePropsFragment = gql`
  fragment PageRead on Page {
    allowComments
    allowContributions
    allowRatings
    contentType
    createdAt
    description
    editor
    icon
    id
    isBrowsable
    locale
    password
    path
    publishEndDate
    publishStartDate
    publishState
    relations {
      id
      position
      label
      caption
      icon
      target
    }
    render
    scriptJsLoad
    scriptJsUnload
    scriptCss
    showSidebar
    showTags
    showToc
    tags {
      tag
      title
    }
    title
    toc
    tocDepth {
      min
      max
    }
    updatedAt
  }
`
const gqlQueries = {
  pageById: gql`
    query loadPage (
      $id: UUID!
    ) {
      pageById(
        id: $id
      ) {
        ...PageRead
      }
    }
    ${pagePropsFragment}
  `,
  pageByPath: gql`
    query loadPage (
      $siteId: UUID!
      $path: String!
    ) {
      pageByPath(
        siteId: $siteId
        path: $path
      ) {
        ...PageRead
      }
    }
    ${pagePropsFragment}
  `
}

export const usePageStore = defineStore('page', {
  state: () => ({
    allowComments: false,
    allowContributions: true,
    allowRatings: true,
    authorId: 0,
    authorName: '',
    commentsCount: 0,
    content: '',
    createdAt: '',
    description: '',
    icon: 'las la-file-alt',
    id: '',
    isBrowsable: true,
    locale: 'en',
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
      return transform(state.path.split('/'), (result, value, key) => {
        result.push({
          id: key,
          title: value,
          icon: 'las la-file-alt',
          locale: 'en',
          path: (last(result)?.path || pathPrefix) + `/${value}`
        })
      }, [])
    },
    folderPath: (state) => {
      return initial(state.path.split('/')).join('/')
    }
  },
  actions: {
    /**
     * PAGE - LOAD
     */
    async pageLoad ({ path, id }) {
      const editorStore = useEditorStore()
      const siteStore = useSiteStore()
      try {
        const resp = await APOLLO_CLIENT.query({
          query: id ? gqlQueries.pageById : gqlQueries.pageByPath,
          variables: id ? { id } : { siteId: siteStore.id, path },
          fetchPolicy: 'network-only'
        })
        const pageData = cloneDeep((id ? resp?.data?.pageById : resp?.data?.pageByPath) ?? {})
        if (!pageData?.id) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        // Update page store
        this.$patch({
          ...pageData,
          relations: pageData.relations.map(r => pick(r, ['id', 'position', 'label', 'caption', 'icon', 'target'])),
          tocDepth: pick(pageData.tocDepth, ['min', 'max'])
        })
        // Update editor state timestamps
        const curDate = DateTime.utc()
        editorStore.$patch({
          lastChangeTimestamp: curDate,
          lastSaveTimestamp: curDate
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
      const editorStore = useEditorStore()

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
      if (path || path === '') {
        this.path = path
      } else {
        this.path = this.path.length < 2 ? 'new-page' : `${this.path}/new-page`
      }
      this.title = ''
      this.description = ''
      this.icon = 'las la-file-alt'
      this.publishState = 'published'
      this.relations = []
      this.tags = []

      this.content = ''
      this.render = ''

      // -> View Mode
      this.mode = 'edit'

      // -> Editor Mode
      editorStore.$patch({
        isActive: true,
        editor,
        mode: 'create'
      })
    },
    /**
     * PAGE SAVE
     */
    async pageSave () {
      const editorStore = useEditorStore()
      try {
        const resp = await APOLLO_CLIENT.mutate({
          mutation: gql`
            mutation savePage (
              $id: UUID!
              $patch: PageUpdateInput!
            ) {
              updatePage (
                id: $id
                patch: $patch
              ) {
                operation {
                  succeeded
                  message
                }
              }
            }
            `,
          variables: {
            id: this.id,
            patch: pick(this, [
              'allowComments',
              'allowContributions',
              'allowRatings',
              // 'content',
              'description',
              'icon',
              'isBrowsable',
              'locale',
              'password',
              'path',
              'publishEndDate',
              'publishStartDate',
              'publishState',
              'relations',
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
        })
        const result = resp?.data?.updatePage?.operation ?? {}
        if (!result.succeeded) {
          throw new Error(result.message)
        }
        // Update editor state timestamps
        const curDate = DateTime.utc()
        editorStore.$patch({
          lastChangeTimestamp: curDate,
          lastSaveTimestamp: curDate
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    generateToc () {

    }
  }
})
