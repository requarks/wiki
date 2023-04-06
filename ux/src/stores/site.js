import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { clone } from 'lodash-es'

export const useSiteStore = defineStore('site', {
  state: () => ({
    routerLoading: false,
    id: null,
    useLocales: false,
    hostname: '',
    company: '',
    contentLicense: '',
    footerExtra: '',
    dark: false,
    title: '',
    description: '',
    logoText: true,
    search: '',
    searchIsFocused: false,
    searchIsLoading: false,
    searchRestrictLocale: false,
    searchRestrictPath: false,
    printView: false,
    pageDataTemplates: [],
    showSideNav: true,
    showSidebar: true,
    overlay: null,
    features: {
      ratingsMode: 'off',
      reasonForChange: 'required',
      search: false
    },
    editors: {
      asciidoc: false,
      markdown: false,
      wysiwyg: false
    },
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
      sidebarPosition: 'left',
      tocPosition: 'right',
      showSharingMenu: true,
      showPrintBtn: true
    },
    thumbStyle: {
      right: '2px',
      borderRadius: '5px',
      backgroundColor: '#000',
      width: '5px',
      opacity: 0.15
    },
    barStyle: {
      backgroundColor: '#FAFAFA',
      width: '9px',
      opacity: 1
    },
    sideDialogShown: false,
    sideDialogComponent: '',
    docsBase: 'https://next.js.wiki/docs'
  }),
  getters: {
    overlayIsShown: (state) => Boolean(state.overlay)
  },
  actions: {
    async loadSite (hostname) {
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getSiteInfo ($hostname: String!) {
              siteByHostname (
                hostname: $hostname
                exact: false
                ) {
                id
                hostname
                title
                description
                logoText
                company
                contentLicense
                footerExtra
                features {
                  ratingsMode
                  reasonForChange
                  search
                }
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
                theme {
                  dark
                  colorPrimary
                  colorSecondary
                  colorAccent
                  colorHeader
                  colorSidebar
                  sidebarPosition
                  tocPosition
                  showSharingMenu
                  showPrintBtn
                  baseFont
                  contentFont
                }
              }
            }
          `,
          variables: {
            hostname
          }
        })
        const siteInfo = resp.data.siteByHostname
        if (siteInfo) {
          this.id = clone(siteInfo.id)
          this.hostname = clone(siteInfo.hostname)
          this.title = clone(siteInfo.title)
          this.description = clone(siteInfo.description)
          this.logoText = clone(siteInfo.logoText)
          this.company = clone(siteInfo.company)
          this.contentLicense = clone(siteInfo.contentLicense)
          this.footerExtra = clone(siteInfo.footerExtra)
          this.features = {
            ...this.features,
            ...clone(siteInfo.features)
          }
          this.editors = {
            asciidoc: clone(siteInfo.editors.asciidoc.isActive),
            markdown: clone(siteInfo.editors.markdown.isActive),
            wysiwyg: clone(siteInfo.editors.wysiwyg.isActive)
          }
          this.theme = {
            ...this.theme,
            ...clone(siteInfo.theme)
          }
        } else {
          throw new Error('Invalid Site')
        }
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
        throw err
      }
    }
  }
})
