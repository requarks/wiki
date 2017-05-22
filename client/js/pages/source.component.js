'use strict'

import * as ace from 'brace'
import 'brace/theme/tomorrow_night'
import 'brace/mode/markdown'
import pageLoader from '../components/page-loader'

export default {
  name: 'source-view',
  data() {
    return {}
  },
  mounted() {
    let scEditor = ace.edit('source-display')
    scEditor.setTheme('ace/theme/tomorrow_night')
    scEditor.getSession().setMode('ace/mode/markdown')
    scEditor.setOption('fontSize', '14px')
    scEditor.setOption('hScrollBarAlwaysVisible', false)
    scEditor.setOption('wrap', true)
    scEditor.setReadOnly(true)
    scEditor.renderer.updateFull()
    scEditor.renderer.on('afterRender', () => {
      pageLoader.complete()
    })
  }
}
