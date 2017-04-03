'use strict'

import $ from 'jquery'
import * as ace from 'brace'
import 'brace/theme/tomorrow_night'
import 'brace/mode/markdown'
import pageLoader from '../components/page-loader'

module.exports = (alerts) => {
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

    require('../modals/create.js')(currentBasePath)
    require('../modals/move.js')(currentBasePath, alerts)

    scEditor.renderer.on('afterRender', () => {
      pageLoader.complete()
    })
  }
}
