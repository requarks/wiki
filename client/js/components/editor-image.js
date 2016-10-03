
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

		/**
		 * Select a folder
		 *
		 * @param      {string}  fldName  The folder name
		 * @return     {Void}  Void
		 */
		selectFolder: (fldName) => {
			vueImage.currentFolder = fldName;
			vueImage.loadImages();
		},

		/**
		 * Refresh folder list and load images from root
		 *
		 * @return     {Void}  Void
		 */
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

		/**
		 * Loads images in selected folder
		 *
		 * @return     {Void}  Void
		 */
		loadImages: () => {
			vueImage.isLoading = true;
			vueImage.isLoadingText = 'Fetching images...';
			Vue.nextTick(() => {
				socket.emit('uploadsGetImages', { folder: vueImage.currentFolder }, (data) => {
					vueImage.images = data;
					vueImage.isLoading = false;
					vueImage.attachContextMenus();
				});
			});
		},

		/**
		 * Select an image
		 *
		 * @param      {String}  imageId  The image identifier
		 * @return     {Void}  Void
		 */
		selectImage: (imageId) => {
			vueImage.currentImage = imageId;
		},

		/**
		 * Set image alignment
		 *
		 * @param      {String}  align   The alignment
		 * @return     {Void}  Void
		 */
		selectAlignment: (align) => {
			vueImage.currentAlign = align;
		},

		/**
		 * Attach right-click context menus to images and folders
		 *
		 * @return     {Void}  Void
		 */
		attachContextMenus: () => {

			let moveFolders = _.map(vueImage.folders, (f) => {
				return {
					name: (f !== '') ? f : '/ (root)',
					icon: 'fa-folder'
				};
			});

			$.contextMenu('destroy', '.editor-modal-imagechoices > figure');
			$.contextMenu({
				selector: '.editor-modal-imagechoices > figure',
				appendTo: '.editor-modal-imagechoices',
				position: (opt, x, y) => {
					$(opt.$trigger).addClass('is-contextopen');
					let trigPos = $(opt.$trigger).position();
					let trigDim = { w: $(opt.$trigger).width() / 2, h: $(opt.$trigger).height() / 2 }
					opt.$menu.css({ top: trigPos.top + trigDim.h, left: trigPos.left + trigDim.w });
				},
				events: {
					hide: (opt) => {
						$(opt.$trigger).removeClass('is-contextopen');   
					}
				},
				items: {
					rename: {
						name: "Rename",
						icon: "fa-edit",
						callback: (key, opt) => {
							 alert("Clicked on " + key);
						}
					},
					move: {
						name: "Move to...",
						icon: "fa-folder-open-o",
						items: moveFolders
					},
					delete: {
						name: "Delete",
						icon: "fa-trash",
						callback: (key, opt) => {
							 alert("Clicked on " + key);
						}
					}
				}
			});
		}

	}
});

$('#btn-editor-uploadimage input').on('change', (ev) => {

	$(ev.currentTarget).simpleUpload("/uploads/img", {

		name: 'imgfile',
		data: {
			folder: vueImage.currentFolder
		},
		limit: 20,
		expect: 'json',
		allowedExts: ["jpg", "jpeg", "gif", "png", "webp"],
		allowedTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
		maxFileSize: 3145728, // max 3 MB

		init: () => {
			vueImage.isLoading = true;
			vueImage.isLoadingText = 'Preparing to upload...';
		},

		progress: function(progress) {
			vueImage.isLoadingText = 'Uploading...' + Math.round(progress) + '%';
		},

		success: (data) => {
			if(data.ok) {

			} else {
				alerts.pushError('Upload error', data.msg);
			}
		},

		error: function(error) {
			vueImage.isLoading = false;
			alerts.pushError(error.message, this.upload.file.name);
		},

		finish: () => {
			vueImage.isLoading = false;
		}

	});

});