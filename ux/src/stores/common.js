import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { difference } from 'lodash-es'

export const useCommonStore = defineStore('common', {
  state: () => ({
    routerLoading: false,
    locale: localStorage.getItem('locale') || 'en',
    desiredLocale: localStorage.getItem('locale'),
    blocksLoaded: []
  }),
  getters: {},
  actions: {
    async fetchLocaleStrings (locale) {
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query fetchLocaleStrings (
              $locale: String!
            ) {
              localeStrings (
                locale: $locale
              )
            }
          `,
          fetchPolicy: 'cache-first',
          variables: {
            locale
          }
        })
        return resp?.data?.localeStrings
      } catch (err) {
        console.warn(err)
        throw err
      }
    },
    setLocale (locale) {
      this.$patch({
        locale,
        desiredLocale: locale
      })
      localStorage.setItem('locale', locale)
    },
    async loadBlocks (blocks = []) {
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
