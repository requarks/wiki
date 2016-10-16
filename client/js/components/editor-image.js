
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
		images: [],
		uploadSucceeded: false,
		postUploadChecks: 0,
		deleteImageShow: false,
		deleteImageId: 0,
		deleteImageFilename: ''
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

			let selImage = _.find(vueImage.images, ['_id', vueImage.currentImage]);
			selImage.normalizedPath = (selImage.folder === 'f:') ? selImage.filename : selImage.folder.slice(2) + '/' + selImage.filename;
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
			vueImage.isLoadingText = 'Creating new folder...';
			vueImage.isLoading = true;

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
			vueImage.fetchFromUrlURL = '';
			vueImage.fetchFromUrlShow = true;
			_.delay(() => { $('#txt-editor-fetchimgurl').focus(); }, 400);
		},
		fetchFromUrlDiscard: (ev) => {
			vueImage.fetchFromUrlShow = false;
		},
		fetchFromUrlGo: (ev) => {
			
			vueImage.fetchFromUrlDiscard();
			vueImage.isLoadingText = 'Fetching image...';
			vueImage.isLoading = true;

			Vue.nextTick(() => {
				socket.emit('uploadsFetchFileFromURL', { folder: vueImage.currentFolder, fetchUrl: vueImage.fetchFromUrlURL }, (data) => {
					if(data.ok) {
						vueImage.waitUploadComplete();
					} else {
						vueImage.isLoading = false;
						alerts.pushError('Upload error', data.msg);
					}
				});
			});

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
			vueImage.isLoadingText = 'Fetching folders list...';
			vueImage.isLoading = true;
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
		loadImages: (silent) => {
			if(!silent) {
				vueImage.isLoadingText = 'Fetching images...';
				vueImage.isLoading = true;
			}
			Vue.nextTick(() => {
				socket.emit('uploadsGetImages', { folder: vueImage.currentFolder }, (data) => {
					vueImage.images = data;
					if(!silent) {
						vueImage.isLoading = false;
					}
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
							vueImage.deleteImageId = _.toString($(opt.$trigger).data('uid'));
							vueImage.deleteImageWarn(true);
						}
					}
				}
			});
		},

		deleteImageWarn: (show) => {
			if(show) {
				let c = _.find(vueImage.images, ['_id', vueImage.deleteImageId ]);
				if(c) {
					vueImage.deleteImageFilename = c.filename;
				} else {
					vueImage.deleteImageFilename = 'this image';
				}
			}
			vueImage.deleteImageShow = show;
		},

		deleteImageGo: () => {
			vueImage.deleteImageWarn(false);
			vueImage.isLoadingText = 'Deleting image...';
			vueImage.isLoading = true;
			Vue.nextTick(() => {
				socket.emit('uploadsDeleteFile', { uid: vueImage.deleteImageId }, (data) => {
					vueImage.loadImages();
				});
			});
		},

		waitUploadComplete: () => {

			vueImage.postUploadChecks++;
			vueImage.isLoadingText = 'Processing...';

			let currentUplAmount = vueImage.images.length;
			vueImage.loadImages(true);

			Vue.nextTick(() => {
				_.delay(() => {
					if(currentUplAmount !== vueImage.images.length) {
						vueImage.postUploadChecks = 0;
						vueImage.isLoading = false;
					} else if(vueImage.postUploadChecks > 5) {
						vueImage.postUploadChecks = 0;
						vueImage.isLoading = false;
						alerts.pushError('Unable to fetch new listing', 'Try again later');
					} else {
						vueImage.waitUploadComplete();
					}
				}, 2000);
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

		init: (totalUploads) => {
			vueImage.uploadSucceeded = false;
			vueImage.isLoadingText = 'Preparing to upload...';
			vueImage.isLoading = true;
		},

		progress: function(progress) {
			vueImage.isLoadingText = 'Uploading...' + Math.round(progress) + '%';
		},

		success: (data) => {
			if(data.ok) {

				let failedUpls = _.filter(data.results, ['ok', false]);
				if(failedUpls.length) {
					_.forEach(failedUpls, (u) => {
						alerts.pushError('Upload error', u.msg);
					});
					if(failedUpls.length < data.results.length) {
						alerts.push({
							title: 'Some uploads succeeded',
							message: 'Files that are not mentionned in the errors above were uploaded successfully.'
						});
						vueImage.uploadSucceeded = true;
					} 
				} else {
					vueImage.uploadSucceeded = true;
				}

			} else {
				alerts.pushError('Upload error', data.msg);
			}
		},

		error: function(error) {
			alerts.pushError(error.message, this.upload.file.name);
		},

		finish: () => {
			if(vueImage.uploadSucceeded) {
				vueImage.waitUploadComplete();
			} else {
				vueImage.isLoading = false;
			}
		}

	});

});