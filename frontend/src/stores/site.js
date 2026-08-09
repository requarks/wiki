import { defineStore } from 'pinia'

import { sortBy } from 'es-toolkit/array'

import { useUserStore } from './user'

/**
 * Turn the site's active locale CODES into the descriptors the UI reads.
 *
 * The API stores and returns `locales.active` as bare codes -- `['en']` -- because that is what the
 * admin screen writes back and what the server validates against its installed set. Everything that
 * DISPLAYS a locale, though, wants a name for it: the sidebar's locale menu, the language filter on
 * the search screen, and the check in App.vue that a requested locale is one this site offers. They
 * were each reading `.code` / `.language` / `.nativeName` off a string, so every one of them rendered
 * blank -- the locale menu showed an empty row rather than "English".
 *
 * Resolved here rather than server-side so the write shape stays a plain list of codes, and with
 * `Intl.DisplayNames` rather than a table, which gives the name in the reader's own language for
 * free. Asking for a code's name IN that code is what produces the native spelling.
 */
function describeLocales(codes) {
  const localized = new Intl.DisplayNames(undefined, { type: 'language' })

  return (codes ?? []).map((code) => {
    let name = code
    let nativeName = code
    try {
      name = localized.of(code) ?? code
      nativeName = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
    } catch {
      // -> An unregistered or malformed tag throws rather than returning nothing; show the code
    }
    return {
      code,
      // -> The bare language, for the two-letter badge beside each entry
      language: code.split('-')[0],
      name,
      nativeName
    }
  })
}

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
    /**
     * The extensions this site's content is written in, lowercase and without the dot. A path ending
     * in one of them addresses the page underneath it — `/foo/bar.md` is `/foo/bar` — which the
     * router acts on for links inside pages and the server acts on for requests that reach it.
     */
    pageExtensions: [],
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
      browse: false,
      collaborativeEditing: false,
      profile: false,
      ratingsMode: 'off',
      reasonForChange: 'required',
      search: false
    },
    /** How this site handles signing in. Set in the admin area's Login section. */
    auth: {
      /**
       * Send a visitor who is not logged in straight to the login screen instead of showing them
       * the unauthorized page. For a wiki that is closed to the public, that screen is a dead end
       * with a login button on it, and this skips the step.
       */
      bypassUnauthorized: false
    },
    editors: {
      asciidoc: false,
      markdown: false,
      wysiwyg: false
    },
    locales: {
      primary: 'en',
      showMenu: true,
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
        if (!siteInfo) {
          throw new Error('Invalid Site')
        }
        this.applySiteInfo(siteInfo)
      } catch (err) {
        console.warn(err.message)
        throw err
      }
    },
    /**
     * Take in a site configuration that arrived with something else — `bootstrap` hands it over with
     * the flags and the session, which is how an app load gets all three in one request.
     */
    applySiteInfo(siteInfo) {
      this.$patch({
        id: siteInfo.id,
        hostname: siteInfo.hostname,
        title: siteInfo.title,
        description: siteInfo.description,
        logoText: siteInfo.logoText,
        pageExtensions: siteInfo.pageExtensions ?? [],
        company: siteInfo.company,
        contentLicense: siteInfo.contentLicense,
        footerExtra: siteInfo.footerExtra,
        features: {
          ...this.features,
          ...siteInfo.features
        },
        auth: {
          ...this.auth,
          ...siteInfo.auth
        },
        editors: {
          asciidoc: siteInfo.editors.asciidoc.isActive,
          markdown: siteInfo.editors.markdown.isActive,
          wysiwyg: siteInfo.editors.wysiwyg.isActive
        },
        // -> Spread over the state defaults, as `features` and `theme` above do, so a key the
        //    site config has never been saved with reads as its default rather than undefined
        locales: {
          ...this.locales,
          ...siteInfo.locales,
          active: sortBy(describeLocales(siteInfo.locales.active), ['nativeName', 'name'])
        },
        tags: [],
        tagsLoaded: false,
        theme: {
          ...this.theme,
          ...siteInfo.theme
        }
      })
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
