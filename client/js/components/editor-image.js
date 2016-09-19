
let vueImage = new Vue({
	el: '#modal-editor-image',
	data: {
		isLoading: false,
		isLoadingText: '',
		newFolderName: '',
		newFolderShow: false,
		folders: [],
		currentFolder: '',
		images: []
	},
	methods: {
		open: () => {
			mdeModalOpenState = true;
			$('#modal-editor-image').slideDown();
			vueImage.refreshFolders();
		},
		cancel: (ev) => {
			mdeModalOpenState = false;
			$('#modal-editor-image').slideUp();
		},
		newFolder: (ev) => {
			vueImage.newFolderShow = true;
		},
		newFolderDiscard: (ev) => {
			vueImage.newFolderShow = false;
		},
		selectFolder: (fldName) => {
			vueImage.currentFolder = fldName;
			vueImage.loadImages();
		},
		refreshFolders: () => {
			vueImage.isLoading = true;
			vueImage.isLoadingText = 'Fetching folders list...';
			vueImage.currentFolder = '';
			Vue.nextTick(() => {
				socket.emit('uploadsGetFolders', { }, (data) => {
					vueImage.folders = data;
					vueImage.loadImages();
				});
			});
		},
		loadImages: () => {
			vueImage.isLoading = true;
			vueImage.isLoadingText = 'Fetching images...';
			Vue.nextTick(() => {
				socket.emit('uploadsGetImages', { folder: vueImage.currentFolder }, (data) => {
					vueImage.images = data;
					vueImage.isLoading = false;
				});
			});
		}
	}
});