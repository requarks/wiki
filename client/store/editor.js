import { make } from 'vuex-pathify'

const state = {
  editor: '',
  editorKey: '',
  content: '',
  mode: 'create',
  activeModal: '',
  activeModalData: null,
  media: {
    folderTree: [],
    currentFolderId: 0,
    currentFileId: null
  },
  checkoutDateActive: ''
}

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
    pushMediaFolderTree: (st, folder) => {
      st.media.folderTree = st.media.folderTree.concat(folder)
    },
    popMediaFolderTree: (st) => {
      st.media.folderTree = st.media.folderTree.slice(0, -1)
    }
  }
}
