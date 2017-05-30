<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-orange {{ $t('modal.discardpagetitle') }}
            section
              span(v-if='mode === "create"') {{ $t('modal.discardpagecreate') }}
              span(v-else) {{ $t('modal.discardpageedit') }}
            footer
              a.button.is-grey.is-outlined(v-on:click='stay') {{ $t('modal.discardpagestay') }}
              a.button.is-orange(v-on:click='discard') {{ $t('modal.discard') }}
</template>

<script>
  export default {
    name: 'modal-discard-page',
    props: ['mode', 'currentPath'],
    data () {
      return {}
    },
    computed: {
      isShown () {
        return this.$store.state.modalDiscardPage.shown
      }
    },
    methods: {
      stay: function () {
        this.$store.dispatch('modalDiscardPage/close')
      },
      discard: function () {
        if(this.mode === 'create') {
          window.location.assign('/')
        } else {
          window.location.assign('/' + this.currentPath)
        }
      }
    }
  }
</script>
