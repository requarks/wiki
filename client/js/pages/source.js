
if ($('#page-type-source').length) {
  var scEditor = ace.edit('source-display')
  scEditor.setTheme('ace/theme/tomorrow_night')
  scEditor.getSession().setMode('ace/mode/markdown')
  scEditor.setOption('fontSize', '14px')
  scEditor.setOption('hScrollBarAlwaysVisible', false)
  scEditor.setOption('wrap', true)
  scEditor.setReadOnly(true)
  scEditor.renderer.updateFull()

  let currentBasePath = ($('#page-type-source').data('entrypath') !== 'home') ? $('#page-type-source').data('entrypath') : ''

  // =include ../modals/create.js
	// =include ../modals/move.js
}
