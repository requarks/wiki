import { defineStore } from 'pinia'


export const useFlagsStore = defineStore('flags', {
  state: () => ({
    loaded: false,
    experimental: false
  }),
  getters: {},
  actions: {
    async load () {
      try {
        const systemFlags = await API_CLIENT.get('system/flags')
        if (systemFlags) {
          this.$patch({
            ...systemFlags,
            loaded: true
          })
        } else {
          throw new Error('Could not fetch system flags.')
        }
      } catch (err) {
        console.warn(err.message)
        throw err
      }
    }
  }
})
