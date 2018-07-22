import { make } from 'vuex-pathify'

const state = {
  content: '',
  description: '',
  isPublished: true,
  locale: 'en',
  mode: 'create',
  path: '',
  publishEndDate: '',
  publishStartDate: '',
  tags: [],
  title: ''
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
