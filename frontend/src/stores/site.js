import { defineStore } from 'pinia'

import { sortBy } from 'es-toolkit/array'

import { useUserStore } from './user'

export const useSiteStore = defineStore('site', {
  state: () => ({
    id: null,
    hostname: '',
    company: '',
    contentLicense: '',
    footerExtra: '',
    dark: false,
    title: '',
    description: '',
    logoText: true,
    search: '',
    searchLastQuery: '',
    searchIsLoading: false,
    printView: false,
    pageDataTemplates: [],
    showSideNav: true,
    showSidebar: true,
    overlay: null,
    overlayOpts: {},
    features: {
      profile: false,
      ratingsMode: 'off',
      reasonForChange: 'required',
      search: false
    },
    editors: {
      asciidoc: false,
      markdown: false,
      wysiwyg: false
    },
    locales: {
      primary: 'en',
      active: [
        {
          code: 'en',
          language: 'en',
          name: 'English',
          nativeName: 'English'
        }
      ]
    },
    tags: [],
    tagsLoaded: false,
    theme: {
      dark: false,
      injectCSS: '',
      injectHead: '',
      injectBody: '',
      colorPrimary: '#1976D2',
      colorSecondary: '#02C39A',
      colorAccent: '#f03a47',
      colorHeader: '#000',
      colorSidebar: '#1976D2',
      codeBlocksTheme: '',
      sidebarPosition: 'left',
      tocPosition: 'right',
      showSharingMenu: true,
      showPrintBtn: true
    },
    sideDialogShown: false,
    sideDialogComponent: '',
    docsBase: 'https://beta.js.wiki/docs',
    nav: {
      currentId: null,
      items: []
    }
  }),
  getters: {
    overlayIsShown: (state) => Boolean(state.overlay),
    sideNavIsDisabled: (state) => Boolean(state.theme.sidebarPosition === 'off'),
    scrollStyle: (state) => {
      const userStore = useUserStore()
      let isDark = false
      if (userStore.appearance === 'site') {
        isDark = state.theme.dark
      } else if (userStore.appearance === 'dark') {
        isDark = true
      }
      return {
        thumb: {
          right: '2px',
          borderRadius: '5px',
          backgroundColor: isDark ? '#FFF' : '#000',
          width: '5px',
          opacity: isDark ? 0.25 : 0.15
        },
        bar: {
          backgroundColor: isDark ? '#000' : '#FAFAFA',
          width: '9px',
          opacity: isDark ? 0.25 : 1
        }
      }
    },
    useLocales: (state) => {
      return state.locales?.active?.length > 1
    }
  },
  actions: {
    openFileManager(opts) {
      this.$patch({
        overlay: 'FileManager',
        overlayOpts: {
          insertMode: opts?.insertMode ?? false
        }
      })
    },
    async loadSite(hostname) {
      try {
        const siteInfo = await API_CLIENT.get(`sites/${hostname}`).json()
        if (siteInfo) {
          this.$patch({
            id: siteInfo.id,
            hostname: siteInfo.hostname,
            title: siteInfo.title,
            description: siteInfo.description,
            logoText: siteInfo.logoText,
            company: siteInfo.company,
            contentLicense: siteInfo.contentLicense,
            footerExtra: siteInfo.footerExtra,
            features: {
              ...this.features,
              ...siteInfo.features
            },
            editors: {
              asciidoc: siteInfo.editors.asciidoc.isActive,
              markdown: siteInfo.editors.markdown.isActive,
              wysiwyg: siteInfo.editors.wysiwyg.isActive
            },
            locales: {
              primary: siteInfo.locales.primary,
              active: sortBy(siteInfo.locales.active, ['nativeName', 'name'])
            },
            tags: [],
            tagsLoaded: false,
            theme: {
              ...this.theme,
              ...siteInfo.theme
            }
          })
        } else {
          throw new Error('Invalid Site')
        }
      } catch (err) {
        console.warn(err.message)
        throw err
      }
    },
    async fetchTags(forceRefresh = false) {
      if (this.tagsLoaded && !forceRefresh) {
        return
      }
      try {
        const tags = await API_CLIENT.get(`sites/${this.id}/tags`).json()
        this.$patch({
          tags: tags ?? [],
          tagsLoaded: true
        })
      } catch (err) {
        console.warn(err.message)
        throw err
      }
    },
    /**
     * Load the sidebar menu a page resolves to.
     *
     * @param id The page's `navigationId`, which addresses either a tree entry that overrides the menu
     *           or the site itself for the one every page inherits
     */
    async fetchNavigation(id) {
      try {
        const items = await API_CLIENT.get(`sites/${this.id}/navigation/${id}`).json()
        this.$patch({
          nav: {
            currentId: id,
            items: items ?? []
          }
        })
      } catch (err) {
        // -> An empty sidebar is the right outcome for a menu nobody has set up, rather than an error
        //    in front of a reader who cannot act on it
        console.warn(err.message)
        this.$patch({
          nav: {
            currentId: id,
            items: []
          }
        })
      }
    }
  }
})
