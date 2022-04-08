import { defineStore } from 'pinia'

export const usePageStore = defineStore('page', {
  state: () => ({
    mode: 'view',
    editor: 'wysiwyg',
    editorMode: 'edit',
    id: 0,
    authorId: 0,
    authorName: 'Unknown',
    createdAt: '',
    description: 'How to install Wiki.js on Ubuntu 18.04 / 20.04',
    isPublished: true,
    showInTree: true,
    locale: 'en',
    path: '',
    publishEndDate: '',
    publishStartDate: '',
    tags: ['cities', 'canada'],
    title: 'Ubuntu',
    icon: 'lab la-empire',
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
      {
        id: 1,
        title: 'Installation',
        icon: 'las la-file-alt',
        locale: 'en',
        path: 'installation'
      },
      {
        id: 2,
        title: 'Ubuntu',
        icon: 'lab la-ubuntu',
        locale: 'en',
        path: 'installation/ubuntu'
      }
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
    render: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
  }),
  getters: {},
  actions: {
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
