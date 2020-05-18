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
  publishEndDate: '',
  publishStartDate: '',
  tags: [],
  title: '',
  updatedAt: '',
  mode: '',
  comments: {
    view: false,
    post: false,
    manage: false
  },
  commentsCount: 0
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
