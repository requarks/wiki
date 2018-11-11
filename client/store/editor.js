import { make } from 'vuex-pathify'

const state = {
  content: '',
  mode: 'create'
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
