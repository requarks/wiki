import { defineStore } from 'pinia'

import { difference } from 'es-toolkit/array'

// -> A browser blocking site data throws on merely reading `localStorage`, and a throw here
//    happens while the store is created, which leaves the whole app unmounted
function storedLocale() {
  try {
    return localStorage.getItem('locale')
  } catch {
    return null
  }
}

export const useCommonStore = defineStore('common', {
  state: () => ({
    routerLoading: false,
    locale: storedLocale() || 'en',
    desiredLocale: storedLocale(),
    blocksLoaded: []
  }),
  getters: {},
  actions: {
    async fetchLocaleStrings(locale) {
      try {
        return API_CLIENT.get(`locales/${locale}/strings`).json()
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    setLocale(locale) {
      this.$patch({
        locale,
        desiredLocale: locale
      })
      try {
        localStorage.setItem('locale', locale)
      } catch {
        // -> Refused storage costs remembering the choice, not making it
      }
    },
    async loadBlocks(blocks = []) {
      const toLoad = difference(blocks, this.blocksLoaded)
      for (const block of toLoad) {
        try {
          await import(/* @vite-ignore */ `/_blocks/${block}.js`)
          this.blocksLoaded.push(block)
        } catch (err) {
          console.warn(`Failed to load ${block}: ${err.message}`)
        }
      }
    }
  }
})
