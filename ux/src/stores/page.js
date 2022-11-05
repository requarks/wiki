import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { cloneDeep, last, transform } from 'lodash-es'
import { DateTime } from 'luxon'

import { useSiteStore } from './site'
import { useEditorStore } from './editor'

const gqlQueries = {
  pageById: gql`
    query loadPage (
      $id: UUID!
    ) {
      pageById(
        id: $id
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
  pageByPath: gql`
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
  `
}

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
    commentsCount: 0,
    content: '',
    render: '',
    toc: []
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
        this.$patch(pageData)
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
