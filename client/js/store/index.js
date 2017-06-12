import Vue from 'vue'
import Vuex from 'vuex'

import alert from './modules/alert'
import anchor from './modules/anchor'
import editor from './modules/editor'
import editorCodeblock from './modules/editor-codeblock'
import editorFile from './modules/editor-file'
import editorVideo from './modules/editor-video'
import modalCreatePage from './modules/modal-create-page'
import modalCreateUser from './modules/modal-create-user'
import modalDeleteUser from './modules/modal-delete-user'
import modalDiscardPage from './modules/modal-discard-page'
import modalMovePage from './modules/modal-move-page'
import modalProfile2fa from './modules/modal-profile-2fa'
import modalUpgradeSystem from './modules/modal-upgrade-system'
import pageLoader from './modules/page-loader'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    loading: false
  },
  mutations: {
    loadingChange: (state, loadingState) => { state.loading = loadingState }
  },
  actions: {
    startLoading({ commit }) { commit('loadingChange', true) },
    stopLoading({ commit }) { commit('loadingChange', false) }
  },
  getters: {},
  modules: {
    alert,
    anchor,
    editor,
    editorCodeblock,
    editorFile,
    editorVideo,
    modalCreatePage,
    modalCreateUser,
    modalDeleteUser,
    modalDiscardPage,
    modalMovePage,
    modalProfile2fa,
    modalUpgradeSystem,
    pageLoader
  }
})
