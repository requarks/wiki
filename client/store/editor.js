import { make } from 'vuex-pathify'

const state = {
  title: '',
  description: '',
  tags: [],
  path: '',
  isPublished: true,
  publishEtartDate: '',
  publishEndDate: '',
  locale: 'en'
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
