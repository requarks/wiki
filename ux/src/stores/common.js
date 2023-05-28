import { defineStore } from 'pinia'
import gql from 'graphql-tag'

export const useCommonStore = defineStore('common', {
  state: () => ({
    routerLoading: false,
    locale: localStorage.getItem('locale') || 'en',
    desiredLocale: localStorage.getItem('locale')
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
    }
  }
})
