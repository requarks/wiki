<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content.is-expanded(v-show='isShown')
            header.is-green
              span Insert Code Block
            section.is-gapless
              .columns.is-stretched
                .column.is-one-quarter.modal-sidebar.is-green(style={'max-width':'350px'})
                  .model-sidebar-header Language
                  .model-sidebar-content
                    p.control.is-fullwidth
                      select(v-model='modeSelected')
                        option(v-for='mode in modes', v-bind:value='mode.name') {{ mode.caption }}
                .column.ace-container
                  #codeblock-editor
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') Discard
              a.button.is-green(v-on:click='insertCode') Insert Code Block
</template>

<script>
  let codeEditor
  let ace

  export default {
    name: 'editor-codeblock',
    data () {
      return {
        modes: [],
        modeSelected: 'text',
        modelistLoaded: []
      }
    },
    computed: {
      content () {
        return this.$store.state.editorCodeblock.content
      },
      isShown () {
        return this.$store.state.editorCodeblock.shown
      }
    },
    watch: {
      modeSelected(val, oldVal) {
        this.loadMode(val)
      }
    },
    methods: {
      init () {
        let self = this
        self._.delay(() => {
          codeEditor = ace.edit('codeblock-editor')
          codeEditor.setTheme('ace/theme/tomorrow_night')
          codeEditor.getSession().setMode('ace/mode/' + self.modeSelected)
          codeEditor.setOption('fontSize', '14px')
          codeEditor.setOption('hScrollBarAlwaysVisible', false)
          codeEditor.setOption('wrap', true)
          codeEditor.setOption('showPrintMargin', false)

          codeEditor.setValue(self.content)

          codeEditor.focus()
          codeEditor.renderer.updateFull()
        }, 100)
      },
      loadMode (m) {
        let self = this
        if (self._.includes(self.modelistLoaded, m)) {
          codeEditor.getSession().setMode('ace/mode/' + m)
        } else {
          self.$http.get('/js/ace/mode-' + m + '.js').then(resp => {
            if(resp.ok) {
              eval(resp.bodyText)
              self.modelistLoaded.push(m)
              ace.acequire('ace/mode/' + m)
              codeEditor.getSession().setMode('ace/mode/' + m)
            }
          })
        }
      },
      cancel () {
        codeEditor.destroy()
        this.$store.dispatch('editorCodeblock/close')
      },
      insertCode () {
        let codeBlockText = '\n```' + this.modeSelected + '\n' + codeEditor.getValue() + '\n```\n'
        this.$store.dispatch('editor/insert', codeBlockText)
        this.$store.dispatch('alert', {
          style: 'blue',
          icon: 'inbox',
          msg: 'Your code block has been inserted.'
        })
        this.cancel()
      }
    },
    mounted() {
      FuseBox.import('/js/ace/ace.js', (acePkg) => {
        ace = acePkg
        this.modes = ace.acequire('ace/ext/modelist').modesByName
      })
      this.$root.$on('editorCodeblock/init', this.init)
    }
  }
</script>
