import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { cloneDeep, dropRight, initial, last, pick, transform } from 'lodash-es'
import { DateTime } from 'luxon'

import { useSiteStore } from './site'
import { useEditorStore } from './editor'

const pagePropsFragment = gql`
  fragment PageRead on Page {
    alias
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
    isSearchable
    locale
    navigationId
    navigationMode
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
    tags
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
      $alias: String
      $allowComments: Boolean
      $allowContributions: Boolean
      $allowRatings: Boolean
      $content: String!
      $description: String!
      $editor: String!
      $icon: String
      $isBrowsable: Boolean
      $isSearchable: Boolean
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
        alias: $alias
        allowComments: $allowComments
        allowContributions: $allowContributions
        allowRatings: $allowRatings
        content: $content
        description: $description
        editor: $editor
        icon: $icon
        isBrowsable: $isBrowsable
        isSearchable: $isSearchable
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
    alias: '',
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
    },
    isHome: (state) => {
      return ['', 'home'].includes(state.path)
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
     * PAGE - GET PATH FROM ALIAS
     */
    async pageAlias (alias) {
      const siteStore = useSiteStore()
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query fetchPathFromAlias (
              $siteId: UUID!
              $alias: String!
            ) {
              pathFromAlias (
                siteId: $siteId
                alias: $alias
              ) {
                id
                path
              }
            }
          `,
          variables: { siteId: siteStore.id, alias },
          fetchPolicy: 'cache-first'
        })
        const pagePath = cloneDeep(resp?.data?.pathFromAlias)
        if (!pagePath?.id) {
          throw new Error('ERR_PAGE_NOT_FOUND')
        }
        return pagePath.path
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    /**
     * PAGE - CREATE
     */
    async pageCreate ({ editor, locale, path, basePath, title = '', description = '', content = '', fromNavigate = false } = {}) {
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
        const parentPath = basePath || basePath === '' ? basePath : dropRight(this.path.split('/'), 1).join('/')
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
        alias: '',
        publishState: 'published',
        relations: [],
        tags: [],
        content: content ?? '',
        render: '',
        isBrowsable: true,
        isSearchable: true,
        mode: 'edit'
      })
    },
    /**
     * PAGE - EDIT
     */
    async pageEdit ({ path, id, fromNavigate = false } = {}) {
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

      await this.pageLoad(loadArgs)

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
                'alias',
                'allowComments',
                'allowContributions',
                'allowRatings',
                'content',
                'description',
                'icon',
                'isBrowsable',
                'isSearchable',
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
