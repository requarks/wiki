'use strict'

import SimpleMDE from 'simplemde'
import filesize from 'filesize.js'
import $ from 'jquery'

let mde

export default {
  name: 'editor',
  props: ['currentPath'],
  filters: {
    filesize(v) {
      return this._.toUpper(filesize(v))
    }
  },
  data() {
    return {}
  },
  methods: {
    save() {
      let self = this
      this.$http.put(window.location.href, {
        markdown: mde.value()
      }).then(resp => {
        return resp.json()
      }).then(resp => {
        if (resp.ok) {
          window.location.assign('/' + self.currentPath)
        } else {
          self.$store.dispatch('alert', {
            style: 'red',
            icon: 'square-cross',
            msg: resp.msg
          })
        }
      }).catch(err => {
        self.$store.dispatch('alert', {
          style: 'red',
          icon: 'square-cross',
          msg: 'Error: ' + err.body.msg
        })
      })
    }
  },
  mounted() {
    let self = this
    mde = new SimpleMDE({
      autofocus: true,
      autoDownloadFontAwesome: false,
      element: this.$refs.editorTextArea,
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

    // Save

    this.$root.$on('editor-save', this.save)
    $(window).bind('keydown', (ev) => {
      if (ev.ctrlKey || ev.metaKey) {
        switch (String.fromCharCode(ev.which).toLowerCase()) {
          case 's':
            ev.preventDefault()
            self.save()
            break
        }
      }
    })

    this.$store.dispatch('pageLoader/complete')
  }
}
