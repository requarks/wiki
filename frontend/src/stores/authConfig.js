import { defineStore } from 'pinia'

/**
 * The instance-wide authentication settings — the admin area's Authentication → Configuration
 * screen, which is not part of any site.
 *
 * Separate from `site` because these hold for the whole instance, and from `user` because they say
 * what is on offer rather than who is asking: the login panel reads `allowPasskeys` before there is
 * a session at all. `bootstrap` hands them over with the site, the flags and the session, so an app
 * load gets them without a request of its own.
 *
 * Both default to what the server defaults them to, so the first paint offers what an untouched
 * instance offers rather than briefly hiding it.
 */
export const useAuthConfigStore = defineStore('authConfig', {
  state: () => ({
    allowPasskeys: true,
    allowProfileEditing: true
  }),
  getters: {},
  actions: {
    apply(authConfig) {
      this.$patch({ ...authConfig })
    }
  }
})
