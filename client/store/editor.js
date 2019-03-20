import { make } from 'vuex-pathify'

const state = {
  editor: '',
  content: '',
  mode: 'create',
  activeModal: ''
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
