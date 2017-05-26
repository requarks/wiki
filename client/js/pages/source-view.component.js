'use strict'

/* global FuseBox */

export default {
  name: 'source-view',
  data() {
    return {}
  },
  mounted() {
    let self = this
    FuseBox.import('/js/ace/source-view.js', (ace) => {
      let scEditor = ace.edit('source-display')
      scEditor.setTheme('ace/theme/dawn')
      scEditor.getSession().setMode('ace/mode/markdown')
      scEditor.setOption('fontSize', '14px')
      scEditor.setOption('hScrollBarAlwaysVisible', false)
      scEditor.setOption('wrap', true)
      scEditor.setReadOnly(true)
      scEditor.renderer.updateFull()
      scEditor.renderer.on('afterRender', () => {
        self.$store.dispatch('pageLoader/complete')
      })
    })
  }
}
