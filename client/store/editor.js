import { make } from 'vuex-pathify'

const state = {
  editor: '',
  content: '',
  mode: 'create',
  activeModal: '',
  media: {
    folderTree: [],
    currentFolderId: 0,
    currentFileId: null
  }
}

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
    pushMediaFolderTree: (state, folder) => {
      state.media.folderTree = state.media.folderTree.concat(folder)
    },
    popMediaFolderTree: (state) => {
      state.media.folderTree = state.media.folderTree.slice(0, -1)
    }
  }
}
