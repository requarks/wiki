'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import * as ace from 'brace'
import 'brace/theme/tomorrow_night'
import 'brace/mode/markdown'
import 'brace-ext-modelist'

let codeEditor = null

// ACE - Mode Loader

let modelistLoaded = []
let loadAceMode = (m) => {
  return $.ajax({
    url: '/js/ace/mode-' + m + '.js',
    dataType: 'script',
    cache: true,
    beforeSend: () => {
      if (_.includes(modelistLoaded, m)) {
        return false
      }
    },
    success: () => {
      modelistLoaded.push(m)
    }
  })
}

// Vue Code Block instance

module.exports = (mde, mdeModalOpenState) => {
  let modelist = ace.acequire('ace/ext/modelist')
  let vueCodeBlock = new Vue({
    el: '#modal-editor-codeblock',
    data: {
      modes: modelist.modesByName,
      modeSelected: 'text',
      initContent: ''
    },
    watch: {
      modeSelected: (val, oldVal) => {
        loadAceMode(val).done(() => {
          ace.acequire('ace/mode/' + val)
          codeEditor.getSession().setMode('ace/mode/' + val)
        })
      }
    },
    methods: {
      open: (ev) => {
        $('#modal-editor-codeblock').addClass('is-active')

        _.delay(() => {
          codeEditor = ace.edit('codeblock-editor')
          codeEditor.setTheme('ace/theme/tomorrow_night')
          codeEditor.getSession().setMode('ace/mode/' + vueCodeBlock.modeSelected)
          codeEditor.setOption('fontSize', '14px')
          codeEditor.setOption('hScrollBarAlwaysVisible', false)
          codeEditor.setOption('wrap', true)

          codeEditor.setValue(vueCodeBlock.initContent)

          codeEditor.focus()
          codeEditor.renderer.updateFull()
        }, 300)
      },
      cancel: (ev) => {
        mdeModalOpenState = false  // eslint-disable-line no-undef
        $('#modal-editor-codeblock').removeClass('is-active')
        vueCodeBlock.initContent = ''
      },
      insertCode: (ev) => {
        if (mde.codemirror.doc.somethingSelected()) {
          mde.codemirror.execCommand('singleSelection')
        }
        let codeBlockText = '\n```' + vueCodeBlock.modeSelected + '\n' + codeEditor.getValue() + '\n```\n'

        mde.codemirror.doc.replaceSelection(codeBlockText)
        vueCodeBlock.cancel()
      }
    }
  })
  return vueCodeBlock
}
