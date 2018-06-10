export default {
  namespaced: true,
  state: {
    theme: {
      dark: false
    }
  },
  mutations: {
    setThemeDarkMode(state, payload) {
      state.theme.dark = payload
    }
  }
}
