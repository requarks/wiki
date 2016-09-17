
let vueImage = new Vue({
	el: '#modal-editor-image',
	data: {
		modeSelected: 'text'
	},
	methods: {
		cancel: (ev) => {
			mdeModalOpenState = false;
			$('#modal-editor-image').slideUp();
		},
		insertImage: (ev) => {

			if(mde.codemirror.doc.somethingSelected()) {
				mde.codemirror.execCommand('singleSelection');
			}
			let codeBlockText = '\n```' + vueCodeBlock.modeSelected + '\n' + codeEditor.getValue() + '\n```\n';

			mde.codemirror.doc.replaceSelection(codeBlockText);
			vueCodeBlock.cancel();

		}
	}
});