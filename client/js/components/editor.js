
// ====================================
// Markdown Editor
// ====================================

if($('#mk-editor').length === 1) {

	require.config({paths: { "ace" : "/assets/js/ace"}});

	let scEditor = ace.edit("codeblock-editor");
	scEditor.setTheme("ace/theme/tomorrow_night");
	scEditor.getSession().setMode("ace/mode/markdown");
	scEditor.setOption('hScrollBarAlwaysVisible', false);
	scEditor.setOption('wrap', true);

	var modelist = ace.require("ace/ext/modelist");

	var mde = new SimpleMDE({
		autofocus: true,
		autoDownloadFontAwesome: false,
		element: $("#mk-editor").get(0),
		placeholder: 'Enter Markdown formatted content here...',
		spellChecker: false,
		status: false,
		toolbar: [{
				name: "bold",
				action: SimpleMDE.toggleBold,
				className: "fa fa-bold",
				title: "Bold",
			},
			{
				name: "italic",
				action: SimpleMDE.toggleItalic,
				className: "fa fa-italic",
				title: "Italic",
			},
			{
				name: "strikethrough",
				action: SimpleMDE.toggleStrikethrough,
				className: "fa fa-strikethrough",
				title: "Strikethrough",
			},
			'|',
			{
				name: "heading-1",
				action: SimpleMDE.toggleHeading1,
				className: "fa fa-header fa-header-x fa-header-1",
				title: "Big Heading",
			},
			{
				name: "heading-2",
				action: SimpleMDE.toggleHeading2,
				className: "fa fa-header fa-header-x fa-header-2",
				title: "Medium Heading",
			},
			{
				name: "heading-3",
				action: SimpleMDE.toggleHeading3,
				className: "fa fa-header fa-header-x fa-header-3",
				title: "Small Heading",
			},
			{
				name: "quote",
				action: SimpleMDE.toggleBlockquote,
				className: "fa fa-quote-left",
				title: "Quote",
			},
			'|',
			{
				name: "unordered-list",
				action: SimpleMDE.toggleUnorderedList,
				className: "fa fa-list-ul",
				title: "Bullet List",
			},
			{
				name: "ordered-list",
				action: SimpleMDE.toggleOrderedList,
				className: "fa fa-list-ol",
				title: "Numbered List",
			},
			'|',
			{
				name: "link",
				action: (editor) => {
					$('#modal-editor-link').slideToggle();
				},
				className: "fa fa-link",
				title: "Insert Link",
			},
			{
				name: "image",
				action: (editor) => {
					//todo
				},
				className: "fa fa-image",
				title: "Insert Image",
			},
			'|',
			{
				name: "inline-code",
				action: (editor) => {
					if(!editor.codemirror.doc.somethingSelected()) {
						return alerts.pushError('Invalid selection','You must select at least 1 character first.');
					}
					let curSel = editor.codemirror.doc.getSelections();
					curSel = _.map(curSel, (s) => {
						return '`' + s + '`';
					});
					editor.codemirror.doc.replaceSelections(curSel);
				},
				className: "fa fa-terminal",
				title: "Inline Code",
			},
			{
				name: "code-block",
				action: (editor) => {
					$('#modal-editor-codeblock').slideDown(400, () => {
						scEditor.resize();
						scEditor.focus();
					});
				},
				className: "fa fa-code",
				title: "Code Block",
			},
			'|',
			{
				name: "table",
				action: (editor) => {
					//todo
				},
				className: "fa fa-table",
				title: "Insert Table",
			},
			{
				name: "horizontal-rule",
				action: SimpleMDE.drawHorizontalRule,
				className: "fa fa-minus",
				title: "Horizontal Rule",
			}
		],
		shortcuts: {
			"toggleBlockquote": null,
			"toggleFullScreen": null
		}
	});

}

//-> Save

$('.btn-edit-save').on('click', (ev) => {

	$.ajax(window.location.href, {
		data: {
			markdown: mde.value()
		},
		dataType: 'json',
		method: 'PUT'
	}).then((rData, rStatus, rXHR) => {
		if(rData.ok) {
			window.location.assign('/' + pageEntryPath);
		} else {
			alerts.pushError('Something went wrong', rData.error);
		}
	}, (rXHR, rStatus, err) => {
		alerts.pushError('Something went wrong', 'Save operation failed.');
	});

});