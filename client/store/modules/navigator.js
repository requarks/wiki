import debounce from 'lodash/debounce'

export default {
  namespaced: true,
  state: {
    subtitleShown: false,
    subtitleStyle: '',
    subtitleIcon: false,
    subtitleText: '',
    subtitleStatic: 'Welcome'
  },
  getters: {},
  mutations: {
    subtitleChange (state, opts) {
      state.subtitleShown = (opts.shown === true)
      state.subtitleStyle = opts.style || ''
      state.subtitleIcon = opts.icon || false
      state.subtitleText = opts.msg || ''
    },
    subtitleStatic (state, text) {
      state.subtitleText = text
      state.subtitleStatic = text
    }
  },
  actions: {
    alert ({ commit, dispatch }, opts) {
      opts.shown = true
      commit('subtitleChange', opts)
      dispatch('alertDismiss')
    },
    alertDismiss: debounce(({ commit, state }) => {
      let opts = {
        shown: false,
        style: state.subtitleStyle,
        msg: state.subtitleStatic
      }
      commit('subtitleChange', opts)
    }, 5000)
  }
}
