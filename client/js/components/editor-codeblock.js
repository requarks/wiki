
let codeEditor = ace.edit("codeblock-editor");
codeEditor.setTheme("ace/theme/tomorrow_night");
codeEditor.getSession().setMode("ace/mode/markdown");
codeEditor.setOption('fontSize', '14px');
codeEditor.setOption('hScrollBarAlwaysVisible', false);
codeEditor.setOption('wrap', true);

let modelist = ace.require("ace/ext/modelist");

// ACE - Mode Loader

let modelistLoaded = [];
let loadAceMode = (m) => {
	return $.ajax({
		url: '/js/ace/mode-' + m + '.js',
		dataType: "script",
		cache: true,
		beforeSend: () => {
			if(_.includes(modelistLoaded, m)) {
				return false;
			}
		},
		success: () => {
			modelistLoaded.push(m);
		}
	});
};

// Vue Code Block instance

let vueCodeBlock = new Vue({
	el: '#modal-editor-codeblock',
	data: {
		modes: modelist.modesByName,
		modeSelected: 'text'
	},
	watch: {
		modeSelected: (val, oldVal) => {
			loadAceMode(val).done(() => {
				ace.require("ace/mode/" + val);
				codeEditor.getSession().setMode("ace/mode/" + val);
			});
		}
	},
	methods: {
		cancel: (ev) => {
			mdeModalOpenState = false;
			$('#modal-editor-codeblock').slideUp();
		},
		insertCode: (ev) => {

			if(mde.codemirror.doc.somethingSelected()) {
				mde.codemirror.execCommand('singleSelection');
			}
			let codeBlockText = '\n```' + vueCodeBlock.modeSelected + '\n' + codeEditor.getValue() + '\n```\n';

			mde.codemirror.doc.replaceSelection(codeBlockText);
			vueCodeBlock.cancel();

		}
	}
});