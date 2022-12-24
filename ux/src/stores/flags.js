import { defineStore } from 'pinia'
import gql from 'graphql-tag'

export const useFlagsStore = defineStore('flags', {
  state: () => ({
    loaded: false,
    experimental: false
  }),
  getters: {},
  actions: {
    async load () {
      try {
        const resp = await APOLLO_CLIENT.query({
          query: gql`
            query getFlag {
              systemFlags
            }
          `,
          fetchPolicy: 'network-only'
        })
        const systemFlags = resp.data.systemFlags
        if (systemFlags) {
          this.$patch({
            ...systemFlags,
            loaded: true
          })
        } else {
          throw new Error('Could not fetch system flags.')
        }
      } catch (err) {
        console.warn(err.networkError?.result ?? err.message)
        throw err
      }
    }
  }
})
