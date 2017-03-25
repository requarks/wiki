'use strict'

/* global $, Vue, _, filesize, SimpleMDE, alerts, vueImage, vueFile, vueVideo, vueCodeBlock */

// ====================================
// Markdown Editor
// ====================================

if ($('#mk-editor').length === 1) {
  let mdeModalOpenState = false
  let mdeCurrentEditor = null // eslint-disable-line no-unused-vars

  Vue.filter('filesize', (v) => {
    return _.toUpper(filesize(v))
  })

  /* eslint-disable spaced-comment */
  //=include editor-image.js
  //=include editor-file.js
  //=include editor-video.js
  //=include editor-codeblock.js
  /* eslint-enable spaced-comment */

  var mde = new SimpleMDE({
    autofocus: true,
    autoDownloadFontAwesome: false,
    element: $('#mk-editor').get(0),
    placeholder: 'Enter Markdown formatted content here...',
    spellChecker: false,
    status: false,
    toolbar: [
      {
        name: 'bold',
        action: SimpleMDE.toggleBold,
        className: 'icon-bold',
        title: 'Bold'
      },
      {
        name: 'italic',
        action: SimpleMDE.toggleItalic,
        className: 'icon-italic',
        title: 'Italic'
      },
      {
        name: 'strikethrough',
        action: SimpleMDE.toggleStrikethrough,
        className: 'icon-strikethrough',
        title: 'Strikethrough'
      },
      '|',
      {
        name: 'heading-1',
        action: SimpleMDE.toggleHeading1,
        className: 'icon-header fa-header-x fa-header-1',
        title: 'Big Heading'
      },
      {
        name: 'heading-2',
        action: SimpleMDE.toggleHeading2,
        className: 'icon-header fa-header-x fa-header-2',
        title: 'Medium Heading'
      },
      {
        name: 'heading-3',
        action: SimpleMDE.toggleHeading3,
        className: 'icon-header fa-header-x fa-header-3',
        title: 'Small Heading'
      },
      {
        name: 'quote',
        action: SimpleMDE.toggleBlockquote,
        className: 'icon-quote-left',
        title: 'Quote'
      },
      '|',
      {
        name: 'unordered-list',
        action: SimpleMDE.toggleUnorderedList,
        className: 'icon-th-list',
        title: 'Bullet List'
      },
      {
        name: 'ordered-list',
        action: SimpleMDE.toggleOrderedList,
        className: 'icon-list-ol',
        title: 'Numbered List'
      },
      '|',
      {
        name: 'link',
        action: (editor) => {
          /* if(!mdeModalOpenState) {
            mdeModalOpenState = true;
            $('#modal-editor-link').slideToggle();
          } */
          window.alert('Coming soon!')
        },
        className: 'icon-link2',
        title: 'Insert Link'
      },
      {
        name: 'image',
        action: (editor) => {
          if (!mdeModalOpenState) {
            vueImage.open()
          }
        },
        className: 'icon-image',
        title: 'Insert Image'
      },
      {
        name: 'file',
        action: (editor) => {
          if (!mdeModalOpenState) {
            vueFile.open()
          }
        },
        className: 'icon-paper',
        title: 'Insert File'
      },
      {
        name: 'video',
        action: (editor) => {
          if (!mdeModalOpenState) {
            vueVideo.open()
          }
        },
        className: 'icon-video-camera2',
        title: 'Insert Video Player'
      },
      '|',
      {
        name: 'inline-code',
        action: (editor) => {
          if (!editor.codemirror.doc.somethingSelected()) {
            return alerts.pushError('Invalid selection', 'You must select at least 1 character first.')
          }
          let curSel = editor.codemirror.doc.getSelections()
          curSel = _.map(curSel, (s) => {
            return '`' + s + '`'
          })
          editor.codemirror.doc.replaceSelections(curSel)
        },
        className: 'icon-terminal',
        title: 'Inline Code'
      },
      {
        name: 'code-block',
        action: (editor) => {
          if (!mdeModalOpenState) {
            mdeModalOpenState = true

            if (mde.codemirror.doc.somethingSelected()) {
              vueCodeBlock.initContent = mde.codemirror.doc.getSelection()
            }

            vueCodeBlock.open()
          }
        },
        className: 'icon-code',
        title: 'Code Block'
      },
      '|',
      {
        name: 'table',
        action: (editor) => {
          window.alert('Coming soon!')
          // todo
        },
        className: 'icon-table',
        title: 'Insert Table'
      },
      {
        name: 'horizontal-rule',
        action: SimpleMDE.drawHorizontalRule,
        className: 'icon-minus2',
        title: 'Horizontal Rule'
      }
    ],
    shortcuts: {
      'toggleBlockquote': null,
      'toggleFullScreen': null
    }
  })

  // -> Save

  let saveCurrentDocument = (ev) => {
    $.ajax(window.location.href, {
      data: {
        markdown: mde.value()
      },
      dataType: 'json',
      method: 'PUT'
    }).then((rData, rStatus, rXHR) => {
      if (rData.ok) {
        window.location.assign('/' + pageEntryPath) // eslint-disable-line no-undef
      } else {
        alerts.pushError('Something went wrong', rData.error)
      }
    }, (rXHR, rStatus, err) => {
      alerts.pushError('Something went wrong', 'Save operation failed.')
    })
  }

  $('.btn-edit-save, .btn-create-save').on('click', (ev) => {
    saveCurrentDocument(ev)
  })

  $(window).bind('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey) {
      switch (String.fromCharCode(ev.which).toLowerCase()) {
        case 's':
          ev.preventDefault()
          saveCurrentDocument(ev)
          break
      }
    }
  })
}
