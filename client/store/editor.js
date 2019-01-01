import { make } from 'vuex-pathify'

const state = {
  editor: '',
  content: '',
  mode: 'create'
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
