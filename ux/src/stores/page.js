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
  `,
  pageByIdWithContent: gql`
    query loadPageWithContent (
      $id: UUID!
    ) {
      pageById(
        id: $id
      ) {
        ...PageRead,
        content
      }
    }
    ${pagePropsFragment}
  `,
  pageByPathWithContent: gql`
    query loadPageWithContent (
      $siteId: UUID!
      $path: String!
    ) {
      pageByPath(
        siteId: $siteId
        path: $path
      ) {
        ...PageRead,
        content
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
    editor: '',
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
    async pageLoad ({ path, id, withContent = false }) {
      const editorStore = useEditorStore()
      const siteStore = useSiteStore()
      try {
        let query
        if (withContent) {
          query = id ? gqlQueries.pageByIdWithContent : gqlQueries.pageByPathWithContent
        } else {
          query = id ? gqlQueries.pageById : gqlQueries.pageByPath
        }
        const resp = await APOLLO_CLIENT.query({
          query,
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
    pageCreate ({ editor, locale, path, title = '', description = '', content = '' }) {
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
      this.title = title ?? ''
      this.description = description ?? ''
      this.icon = 'las la-file-alt'
      this.publishState = 'published'
      this.relations = []
      this.tags = []

      this.content = content ?? ''
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
      const siteStore = useSiteStore()
      try {
        if (editorStore.mode === 'create') {
          const resp = await APOLLO_CLIENT.mutate({
            mutation: gql`
              mutation createPage (
                $allowComments: Boolean
                $allowContributions: Boolean
                $allowRatings: Boolean
                $content: String!
                $description: String!
                $editor: String!
                $icon: String
                $isBrowsable: Boolean
                $locale: String!
                $path: String!
                $publishState: PagePublishState!
                $publishEndDate: Date
                $publishStartDate: Date
                $relations: [PageRelationInput!]
                $scriptCss: String
                $scriptJsLoad: String
                $scriptJsUnload: String
                $showSidebar: Boolean
                $showTags: Boolean
                $showToc: Boolean
                $siteId: UUID!
                $tags: [String!]
                $title: String!
                $tocDepth: PageTocDepthInput
              ) {
                createPage (
                  allowComments: $allowComments
                  allowContributions: $allowContributions
                  allowRatings: $allowRatings
                  content: $content
                  description: $description
                  editor: $editor
                  icon: $icon
                  isBrowsable: $isBrowsable
                  locale: $locale
                  path: $path
                  publishState: $publishState
                  publishEndDate: $publishEndDate
                  publishStartDate: $publishStartDate
                  relations: $relations
                  scriptCss: $scriptCss
                  scriptJsLoad: $scriptJsLoad
                  scriptJsUnload: $scriptJsUnload
                  showSidebar: $showSidebar
                  showTags: $showTags
                  showToc: $showToc
                  siteId: $siteId
                  tags: $tags
                  title: $title
                  tocDepth: $tocDepth
                ) {
                  operation {
                    succeeded
                    message
                  }
                }
              }
              `,
            variables: {
              ...pick(this, [
                'allowComments',
                'allowContributions',
                'allowRatings',
                'content',
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
              ]),
              editor: editorStore.editor,
              siteId: siteStore.id
            }
          })
          const result = resp?.data?.createPage?.operation ?? {}
          if (!result.succeeded) {
            throw new Error(result.message)
          }
          this.id = resp.data.createPage.page.id
          this.editor = editorStore.editor
        } else {
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
                'content',
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
