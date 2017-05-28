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
  export default {
    name: 'editor-codeblock',
    data () {
      return {}
    },
    computed: {
      isShown () {
        return this.$store.state.editorCodeblock.shown
      }
    },
    methods: {
      cancel () {
        this.$store.dispatch('editorCodeBlock/close')
      },
      insertCode () {
        this.$store.dispatch('alert', {
          style: 'pink',
          icon: 'inbox',
          msg: 'Your code block has been inserted.'
        })
        this.cancel()
      }
    }
  }
</script>
