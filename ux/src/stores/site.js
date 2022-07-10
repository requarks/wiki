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
    dark: false,
    title: '',
    description: '',
    logoUrl: '',
    search: '',
    searchIsFocused: false,
    searchIsLoading: false,
    searchRestrictLocale: false,
    searchRestrictPath: false,
    printView: false,
    ratingsMode: 'thumbs',
    pageDataTemplates: [],
    showSideNav: true,
    showSidebar: true,
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
    }
  }),
  getters: {},
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
          this.logoUrl = clone(siteInfo.logoUrl)
          this.company = clone(siteInfo.company)
          this.contentLicense = clone(siteInfo.contentLicense)
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
