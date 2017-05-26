<template lang="pug">
  .modal(v-bind:class='{ "is-active": isShown }')
    .modal-background
    .modal-container
      .modal-content
        header.is-light-blue Create New Document
        section
          label.label Enter the new document path:
          p.control.is-fullwidth(v-bind:class='{ "is-loading": isLoading }')
            input.input(type='text', placeholder='page-name', v-model='entrypath', autofocus)
            span.help.is-danger(v-show='isInvalid') This document path is invalid!
        footer
          a.button.is-grey.is-outlined(v-on:click='cancel') Discard
          a.button.is-light-blue(v-on:click='create') Create
</template>

<script>
  import { mapState } from 'vuex'

  export default {
    name: 'modal-create-page',
    props: ['basepath'],
    data () {
      return {
        isLoading: false
      }
    },
    computed: {
      entrypath () { return this.$store.state.modalCreatePage.entrypath }
      isShown () { return this.$store.state.modalCreatePage.shown }
      isInvalid () { return this.$store.state.modalCreatePage.invalid }
    },
    methods: {
      cancel: function () {
        this.$store.dispatch('modalCreatePage/close')
      },
      create: function () {
        this.isInvalid = false
        let newDocPath = this.helpers.pages.makeSafePath(this.entrypath)
        if (this._.isEmpty(newDocPath)) {
          this.$store.createPage.commit('')
        } else {
          this.isLoading = true
          window.location.assign('/create/' + newDocPath)
        }
      }
    },
    mounted () {
      this.$store.commit('modalCreatePage/pathChange', this.basepath + '/new-page')
    }
  }
</script>
