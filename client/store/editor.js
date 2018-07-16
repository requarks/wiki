import { make } from 'vuex-pathify'

const state = {
  title: '',
  description: '',
  tags: [],
  path: '',
  isPublished: true,
  publishStartDate: '',
  publishEndDate: '',
  locale: 'en',
  mode: 'create'
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
