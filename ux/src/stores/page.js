import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { cloneDeep, dropRight, initial, last, pick, transform } from 'lodash-es'
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

const gqlMutations = {
  createPage: gql`
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
      $render: String
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
        render: $render
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
        page {
          ...PageRead
        }
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
        const parentPath = dropRight(this.path.split('/'), 1).join('/')
        newPath = parentPath ? `${parentPath}/new-page` : 'new-page'
      }

      // -> Set Default Page Data
      this.$patch({
        id: 0,
        locale: locale || this.locale,
        path: newPath,
        title: title ?? '',
        description: description ?? '',
        icon: 'las la-file-alt',
        publishState: 'published',
        relations: [],
        tags: [],
        content: content ?? '',
        render: '',
        mode: 'edit'
      })

      this.router.push('/_create')
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
            mutation: gqlMutations.createPage,
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
              ]),
              editor: editorStore.editor,
              siteId: siteStore.id
            }
          })
          const result = resp?.data?.createPage?.operation ?? {}
          if (!result.succeeded) {
            throw new Error(result.message)
          }
          const pageData = cloneDeep(resp.data.createPage.page ?? {})
          if (!pageData?.id) {
            throw new Error('ERR_CREATED_PAGE_NOT_FOUND')
          }
          // Update page store
          this.$patch({
            ...pageData,
            relations: pageData.relations.map(r => pick(r, ['id', 'position', 'label', 'caption', 'icon', 'target'])),
            tocDepth: pick(pageData.tocDepth, ['min', 'max'])
          })

          editorStore.$patch({
            mode: 'edit'
          })

          this.router.replace(`/${this.path}`)
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
              patch: {
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
                ]),
                reasonForChange: editorStore.reasonForChange
              }
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
          lastSaveTimestamp: curDate,
          reasonForChange: ''
        })
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    async cancelPageEdit () {
      const editorStore = useEditorStore()
      await this.pageLoad({ id: editorStore.originPageId ? editorStore.originPageId : this.id })
      this.router.replace(`/${this.path}`)
    },
    generateToc () {

    }
  }
})
