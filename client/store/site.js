import { make } from 'vuex-pathify'

/* global siteConfig */

const state = {
  company: '',
  dark: siteConfig.darkMode,
  mascot: true,
  title: siteConfig.title
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
