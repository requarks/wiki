import { make } from 'vuex-pathify'

const state = {
  id: 0,
  authorId: 0,
  authorName: 'Unknown',
  createdAt: '',
  description: '',
  isPublished: true,
  locale: 'en',
  path: '',
  tags: [],
  title: '',
  updatedAt: ''
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
