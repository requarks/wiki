import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { clone, sortBy } from 'lodash-es'

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
      active: [{
        code: 'en',
        language: 'en',
        name: 'English',
        nativeName: 'English'
      }]
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
    docsBase: 'https://next.js.wiki/docs'
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
    openFileManager (opts) {
      this.$patch({
        overlay: 'FileManager',
        overlayOpts: {
          insertMode: opts?.insertMode ?? false
        }
      })
    },
    async loadSite (hostname) {
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getSiteInfo ($hostname: String!) {
              siteByHostname (
                hostname: $hostname
                exact: false
                ) {
                company
                contentLicense
                description
                editors {
                  asciidoc {
                    isActive
                  }
                  markdown {
                    isActive
                  }
                  wysiwyg {
                    isActive
                  }
                }
                features {
                  profile
                  ratingsMode
                  reasonForChange
                  search
                }
                footerExtra
                hostname
                id
                locales {
                  primary
                  active {
                    code
                    language
                    name
                    nativeName
                  }
                }
                logoText
                theme {
                  dark
                  colorPrimary
                  colorSecondary
                  colorAccent
                  colorHeader
                  colorSidebar
                  codeBlocksTheme
                  sidebarPosition
                  tocPosition
                  showSharingMenu
                  showPrintBtn
                  baseFont
                  contentFont
                }
                title
              }
            }
          `,
          variables: {
            hostname
          }
        })
        const siteInfo = resp.data.siteByHostname
        if (siteInfo) {
          this.$patch({
            id: clone(siteInfo.id),
            hostname: clone(siteInfo.hostname),
            title: clone(siteInfo.title),
            description: clone(siteInfo.description),
            logoText: clone(siteInfo.logoText),
            company: clone(siteInfo.company),
            contentLicense: clone(siteInfo.contentLicense),
            footerExtra: clone(siteInfo.footerExtra),
            features: {
              ...this.features,
              ...clone(siteInfo.features)
            },
            editors: {
              asciidoc: clone(siteInfo.editors.asciidoc.isActive),
              markdown: clone(siteInfo.editors.markdown.isActive),
              wysiwyg: clone(siteInfo.editors.wysiwyg.isActive)
            },
            locales: {
              primary: clone(siteInfo.locales.primary),
              active: sortBy(clone(siteInfo.locales.active), ['nativeName', 'name'])
            },
            tags: [],
            tagsLoaded: false,
            theme: {
              ...this.theme,
              ...clone(siteInfo.theme)
            }
          })
        } else {
          throw new Error('Invalid Site')
        }
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
        throw err
      }
    },
    async fetchTags (forceRefresh = false) {
      if (this.tagsLoaded && !forceRefresh) { return }
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getSiteTags ($siteId: UUID!) {
              tags (
                siteId: $siteId
                ) {
                tag
                usageCount
              }
            }
          `,
          variables: {
            siteId: this.id
          }
        })
        this.$patch({
          tags: resp.data.tags ?? [],
          tagsLoaded: true
        })
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
        throw err
      }
    }
  }
})
