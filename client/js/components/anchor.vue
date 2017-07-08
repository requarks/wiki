<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-blue
              span {{ $t('modal.anchortitle') }}
            section
              p.control.is-fullwidth
                input.input(type='text', ref='anchorURLinput', v-model='anchorURL')
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') {{ $t('modal.discard') }}
              a.button.is-blue(v-clipboard='anchorURL', @success="clipboardSuccess", @error="clipboardError") {{ $t('modal.copyclipboard') }}
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
        this.$store.dispatch('anchor/close')
      },
      clipboardSuccess () {
        this.$store.dispatch('alert', {
          style: 'blue',
          icon: 'business_notes',
          msg: this.$t('modal.anchorsuccess')
        })
        this.$store.dispatch('anchor/close')
      },
      clipboardError () {
        this.$store.dispatch('alert', {
          style: 'red',
          icon: 'business_notes',
          msg: this.$t('modal.anchorerror')
        })
        this.$refs.anchorURLinput.select()
      }
    }
  }
</script>
