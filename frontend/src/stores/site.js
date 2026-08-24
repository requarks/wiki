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
 * The descriptors come from the server -- `bootstrap` hands the installed list over with the site,
 * so it costs no request of its own -- because half of what they say cannot be worked out from a
 * code here: whether the short form is `fr` or `fr-FR` depends on which OTHER locales exist, and an
 * administrator can rename either. `Intl` still answers for a code the server did not, which is a
 * locale the site has active and the wiki no longer has installed.
 */
function describeLocales(codes, installed) {
  const known = new Map((installed ?? []).map((lc) => [lc.code, lc]))
  // -> `languageDisplay: 'standard'` names the language first -- "Portuguese (Brazil)" rather than
  //    Intl's default "Brazilian Portuguese" -- matching how the server names them
  const nameOptions = { type: 'language', languageDisplay: 'standard' }
  const localized = new Intl.DisplayNames(undefined, nameOptions)

  return (codes ?? []).map((code) => {
    if (known.has(code)) {
      return known.get(code)
    }
    let name = code
    let nativeName = code
    try {
      name = localized.of(code) ?? code
      nativeName = new Intl.DisplayNames([code], nameOptions).of(code) ?? code
    } catch {
      // -> An unregistered or malformed tag throws rather than returning nothing; show the code
    }
    return {
      code,
      // -> The bare language, for the two-letter badge beside each entry
      language: code.split('-')[0],
      name,
      nativeName,
      displayCode: code,
      displayName: nativeName
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
    /**
     * The notice an administrator can raise above the contents of every page — an outage, a freeze,
     * a wiki being moved. `content` is markdown, rendered by `SiteBanner.vue` at display time rather
     * than stored as HTML: it is site configuration, and never goes through the page renderer.
     */
    banner: {
      isEnabled: false,
      title: '',
      content: ''
    },
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
    /** Every installed locale, as this wiki refers to it. Empty until the app has bootstrapped. */
    installedLocales: [],
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
    docsBase: 'https://docs.js.wiki',
    nav: {
      currentId: null,
      items: []
    }
  }),
  getters: {
    /** How a locale is referred to — `fr` for `fr-FR` — falling back to the code until read. */
    localeAlias: (state) => (code) =>
      state.installedLocales.find((lc) => lc.code === code)?.displayCode ?? code,
    /**
     * The segments a locale-prefixed URL may start with, mapped to the locale each names.
     *
     * Every code a locale answers to, not only the short one it is addressed by now: an alias an
     * administrator changed leaves the links people have already saved pointing at the old segment,
     * and a wiki that 404s them has broken them. Mirrors `localePrefixesFor` on the server.
     *
     * Recognised whatever `forcePrefix` says. That setting decides only whether an UNPREFIXED path is
     * sent to the primary locale; a prefix is how any other locale is addressed at all, so a site with
     * it off still has to answer `/fr/...`. The cost is that a site with a locale active cannot also
     * have a page whose first path segment is that locale's short code.
     */
    localePrefixes: (state) => {
      const prefixes = new Map()
      for (const lc of state.locales.active) {
        for (const segment of [lc.displayCode, lc.derivedCode, lc.code]) {
          if (segment) {
            prefixes.set(segment, lc.code)
          }
        }
      }
      return prefixes
    },
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
    /**
     * The leading segment a page URL in this locale carries, empty where it needs none.
     *
     * The one place that answers it: the router reads a prefix back with `localePrefixes`, and
     * everything that builds a page URL — a breadcrumb, the way out of the editor, the logo, the
     * locale selector — has to write the same one. The short code, as the prefix and the storage
     * folder both are.
     *
     * A locale that is not the site's primary always carries one, `forcePrefix` or not: there is no
     * other way to address it. The primary carries one only when the setting is on, which is what
     * that setting is — with it off, `/notes/one` is the canonical address of the primary locale's
     * page and prefixing it would be noise on the single-locale wikis that are most of them.
     */
    localeUrlPrefix() {
      return (code) =>
        this.locales.forcePrefix || code !== this.locales.primary
          ? `/${this.localeAlias(code)}`
          : ''
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
        // -> The locale descriptors come alongside rather than after, so the selector's label is
        //    right on the first paint instead of flicking from `fr-FR` to `fr`
        const [siteInfo, locales] = await Promise.all([
          API_CLIENT.get(`sites/${hostname}`).json(),
          // -> Not worth failing a page load over; `describeLocales` falls back to `Intl`
          API_CLIENT.get('locales')
            .json()
            .catch(() => null)
        ])
        if (!siteInfo) {
          throw new Error('Invalid Site')
        }
        if (locales) {
          this.installedLocales = locales.filter((lc) => lc.isInstalled)
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
        banner: {
          ...this.banner,
          ...siteInfo.banner
        },
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
          active: sortBy(describeLocales(siteInfo.locales.active, this.installedLocales), [
            'displayName'
          ])
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
