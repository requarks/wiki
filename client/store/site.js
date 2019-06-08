import { make } from 'vuex-pathify'

/* global siteConfig */

const state = {
  company: siteConfig.company,
  dark: siteConfig.darkMode,
  mascot: true,
  title: siteConfig.title,
  search: '',
  searchIsFocused: false,
  searchIsLoading: false,
  searchRestrictLocale: false,
  searchRestrictPath: false
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
