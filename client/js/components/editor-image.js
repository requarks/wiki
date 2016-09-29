
let vueImage = new Vue({
	el: '#modal-editor-image',
	data: {
		isLoading: false,
		isLoadingText: '',
		newFolderName: '',
		newFolderShow: false,
		newFolderError: false,
		fetchFromUrlURL: '',
		fetchFromUrlShow: false,
		folders: [],
		currentFolder: '',
		currentImage: '',
		currentAlign: 'left',
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
		insertImage: (ev) => {

			if(mde.codemirror.doc.somethingSelected()) {
				mde.codemirror.execCommand('singleSelection');
			}

			let selImage = _.find(vueImage.images, ['uid', vueImage.currentImage]);
			selImage.normalizedPath = (selImage.folder === '') ? selImage.filename : selImage.folder + '/' + selImage.filename;
			selImage.titleGuess = _.startCase(selImage.basename);

			let imageText = '![' + selImage.titleGuess + '](/uploads/' + selImage.normalizedPath + ' "' + selImage.titleGuess + '")';
			switch(vueImage.currentAlign) {
				case 'center':
					imageText += '{.align-center}';
				break;
				case 'right':
					imageText += '{.align-right}';
				break;
				case 'logo':
					imageText += '{.pagelogo}';
				break;
			}

			mde.codemirror.doc.replaceSelection(imageText);
			vueImage.cancel();

		},
		newFolder: (ev) => {
			vueImage.newFolderName = '';
			vueImage.newFolderError = false;
			vueImage.newFolderShow = true;
			_.delay(() => { $('#txt-editor-newfoldername').focus(); }, 400);
		},
		newFolderDiscard: (ev) => {
			vueImage.newFolderShow = false;
		},
		newFolderCreate: (ev) => {

			let regFolderName = new RegExp("^[a-z0-9][a-z0-9\-]*[a-z0-9]$");
			vueImage.newFolderName = _.kebabCase(_.trim(vueImage.newFolderName));

			if(_.isEmpty(vueImage.newFolderName) || !regFolderName.test(vueImage.newFolderName)) {
				vueImage.newFolderError = true;
				return;
			}

			vueImage.newFolderDiscard();
			vueImage.isLoading = true;
			vueImage.isLoadingText = 'Creating new folder...';

			Vue.nextTick(() => {
				socket.emit('uploadsCreateFolder', { foldername: vueImage.newFolderName }, (data) => {
					vueImage.folders = data;
					vueImage.currentFolder = vueImage.newFolderName;
					vueImage.images = [];
					vueImage.isLoading = false;
				});
			});

		},
		fetchFromUrl: (ev) => {
			vueImage.fetchFromUrlShow = true;
		},
		fetchFromUrlDiscard: (ev) => {
			vueImage.fetchFromUrlShow = false;
		},
		selectFolder: (fldName) => {
			vueImage.currentFolder = fldName;
			vueImage.loadImages();
		},
		refreshFolders: () => {
			vueImage.isLoading = true;
			vueImage.isLoadingText = 'Fetching folders list...';
			vueImage.currentFolder = '';
			vueImage.currentImage = '';
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
		},
		selectImage: (imageId) => {
			vueImage.currentImage = imageId;
		},
		selectAlignment: (align) => {
			vueImage.currentAlign = align;
		}
	}
});