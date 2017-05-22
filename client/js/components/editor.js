'use strict'

import $ from 'jquery'
import Vue from 'vue'
import _ from 'lodash'
import filesize from 'filesize.js'
import SimpleMDE from 'simplemde'
import pageLoader from '../components/page-loader'

// ====================================
// Markdown Editor
// ====================================

module.exports = (alerts, pageEntryPath, socket) => {
  if ($('#mk-editor').length === 1) {
    Vue.filter('filesize', (v) => {
      return _.toUpper(filesize(v))
    })

    let mdeModalOpenState = false
    let vueImage
    let vueFile
    let vueVideo
    let vueCodeBlock
    let vueTable;

    let mde = new SimpleMDE({
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
          className: 'icon-bold no-disable',
          title: 'Bold'
        },
        {
          name: 'italic',
          action: SimpleMDE.toggleItalic,
          className: 'icon-italic no-disable',
          title: 'Italic'
        },
        {
          name: 'strikethrough',
          action: SimpleMDE.toggleStrikethrough,
          className: 'icon-strikethrough no-disable',
          title: 'Strikethrough'
        },
        '|',
        {
          name: 'heading-1',
          action: SimpleMDE.toggleHeading1,
          className: 'icon-header fa-header-x fa-header-1 no-disable',
          title: 'Big Heading'
        },
        {
          name: 'heading-2',
          action: SimpleMDE.toggleHeading2,
          className: 'icon-header fa-header-x fa-header-2 no-disable',
          title: 'Medium Heading'
        },
        {
          name: 'heading-3',
          action: SimpleMDE.toggleHeading3,
          className: 'icon-header fa-header-x fa-header-3 no-disable',
          title: 'Small Heading'
        },
        {
          name: 'quote',
          action: SimpleMDE.toggleBlockquote,
          className: 'icon-quote-left no-disable',
          title: 'Quote'
        },
        '|',
        {
          name: 'unordered-list',
          action: SimpleMDE.toggleUnorderedList,
          className: 'icon-th-list no-disable',
          title: 'Bullet List'
        },
        {
          name: 'ordered-list',
          action: SimpleMDE.toggleOrderedList,
          className: 'icon-list-ol no-disable',
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
          className: 'icon-link2 no-disable',
          title: 'Insert Link'
        },
        {
          name: 'image',
          action: (editor) => {
            if (!mdeModalOpenState) {
              vueImage.open()
            }
          },
          className: 'icon-image no-disable',
          title: 'Insert Image'
        },
        {
          name: 'file',
          action: (editor) => {
            if (!mdeModalOpenState) {
              vueFile.open()
            }
          },
          className: 'icon-paper no-disable',
          title: 'Insert File'
        },
        {
          name: 'video',
          action: (editor) => {
            if (!mdeModalOpenState) {
              vueVideo.open()
            }
          },
          className: 'icon-video-camera2 no-disable',
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
          className: 'icon-terminal no-disable',
          title: 'Inline Code'
        },
        {
          name: 'code-block',
          action: (editor) => {
            if (!mdeModalOpenState) {
              // mdeModalOpenState = true

              if (mde.codemirror.doc.somethingSelected()) {
                vueCodeBlock.initContent = mde.codemirror.doc.getSelection()
              }

              vueCodeBlock.open()
            }
          },
          className: 'icon-code no-disable',
          title: 'Code Block'
        },
        '|',
        {
          name: 'table',
          action: (editor) => {
            vueTable.resContent = "";
            vueTable.prefixContent = "";
            //window.alert('Coming soon!')
            // todo
            if (!mdeModalOpenState){
              if (mde.codemirror.doc.somethingSelected()) {
                // fist check format
                let mdTable = mde.codemirror.doc.getSelection();
                mdTable.replace(/(^\s+)|(\s+$)/g, "");
                //parse table from MD text
                mdTable = mdTable.replace('\r',"");
                let lines = mdTable.split('\n');
                for (let i=0;i<lines.length;i++){
                  if (lines[i].indexOf('|')>-1){
                    vueTable.prefixContent = lines.slice(0,i);
                    lines = lines.slice(i);
                    break;
                  }
                }

                let cols = lines[1].split('|').length + 1;
                if (lines[1].match(/^[\s]*\|/i))
                  cols -= 1;
                else if (!lines[1].match(/^[\s]*\-/i))
                  return alerts.pushError('Invalid selection', 'Not Markdown table format');
                if (lines[1].match(/[\s\S]*\|[\s]*$/i))
                  cols -= 1;
                else if (!lines[1].match(/[\s\S]*\-[\s]*$/i))
                  return alerts.pushError('Invalid selection', 'Not Markdown table format');
                for (let i=0; i < lines.length; i++){
                  if (lines[i].indexOf('|')<0){
                    vueTable.resContent = lines.slice(i);
                    lines = lines.slice(0,i);
                    break;
                  }
                  let num = lines[i].split('|').length;
                  if (!(cols-1 <= num && num <= cols + 1))
                    return alerts.pushError('Invalid selection', 'Number of the columns does not match?');
                }
                vueTable.initContent = lines;
              }
              vueTable.open();
            }
          },
          className: 'icon-table no-disable',
          title: 'Insert Table'
        },
        {
          name: 'horizontal-rule',
          action:SimpleMDE.drawHorizontalRule,
          className: 'icon-minus2 no-disable',
          title: 'Horizontal Rule'
        },
        '|',
        {
          name: 'preview',
          action: (editor) =>{
            SimpleMDE.togglePreview(mde)
            mde.codemirror.focus();
          },
          className: 'icon-eye2 no-disable',
          title: 'Toggle preview'
        },
        {
          name: 'side-by-side',
          action:(editor) =>{
            SimpleMDE.toggleSideBySide(mde)
            mde.codemirror.focus();
          },
          className: 'icon-columns2 no-disable',
          title: 'Toggle Side By Side'
        },
        {
          name: 'fullscreen',
          action:(editor) =>{
            SimpleMDE.toggleFullScreen(mde)
            mde.codemirror.focus();
          },
          className: 'icon-expand no-disable',
          title: 'Toggle Fullscreen'
        }
      ],
      shortcuts: {
        'toggleBlockquote': null,
        'toggleFullScreen': null
      }
    })

    vueImage = require('./editor-image.js')(alerts, mde, mdeModalOpenState, socket)
    vueFile = require('./editor-file.js')(alerts, mde, mdeModalOpenState, socket)
    vueVideo = require('./editor-video.js')(mde, mdeModalOpenState)
    vueCodeBlock = require('./editor-codeblock.js')(mde, mdeModalOpenState)
    vueTable = require('./editor-table.js')(alerts, mde, mdeModalOpenState);

    pageLoader.complete()

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
}