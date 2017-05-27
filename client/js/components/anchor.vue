<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-blue
              span Copy link to this section
            section
              p.control.is-fullwidth
                input.input(type='text', ref='anchorURLinput', v-model='anchorURL')
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') Discard
              a.button.is-blue(v-clipboard='anchorURL', @success="clipboardSuccess", @error="clipboardError") Copy to Clipboard
</template>

<script>
  export default {
    name: 'anchor',
    data () {
      return {}
    },
    computed: {
      anchorURL () {
        return window.location.href.split('#')[0] + '#' + this.$store.state.anchor.hash
      },
      isShown () {
        return this.$store.state.anchor.shown
      }
    },
    methods: {
      cancel () {
        this.$store.dispatch('anchorClose')
      },
      clipboardSuccess () {
        this.$store.dispatch('alert', {
          style: 'blue',
          icon: 'clipboard',
          msg: 'The URL has been copied to your clipboard.'
        })
        this.$store.dispatch('anchorClose')
      },
      clipboardError () {
        this.$store.dispatch('alert', {
          style: 'red',
          icon: 'clipboard',
          msg: 'Clipboard copy failed. Copy the URL manually.'
        })
        this.$refs.anchorURLinput.select()
      }
    }
  }
</script>
