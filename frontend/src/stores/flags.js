import { defineStore } from 'pinia'

export const useFlagsStore = defineStore('flags', {
  state: () => ({
    loaded: false,
    // -> Declared rather than left to `$patch` to create, so that anything reading a flag before the
    //    first load sees `false` instead of `undefined`
    experimental: false,
    authDebug: false,
    sqlLog: false
  }),
  getters: {},
  actions: {
    async load() {
      try {
        const systemFlags = await API_CLIENT.get('system/flags').json()
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
