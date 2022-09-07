import { make } from 'vuex-pathify'

/* global siteConfig */

const state = {
  id: siteConfig.id,
  company: siteConfig.company,
  contentLicense: siteConfig.contentLicense,
  dark: siteConfig.darkMode,
  title: siteConfig.title,
  logoUrl: siteConfig.logoUrl,
  search: '',
  searchIsFocused: false,
  searchIsLoading: false,
  searchRestrictLocale: false,
  searchRestrictPath: false,
  printView: false
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
