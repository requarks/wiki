<template lang="pug">
  .modal(v-if='isShown')
    .modal-background
    .modal-container
      .modal-content
        header.is-light-blue Create New Document
        section
          label.label Enter the new document path:
          p.control.is-fullwidth(v-class='{ "is-loading": isLoading }')
            input.input(type='text', placeholder='page-name', v-model='entrypath', autofocus)
            span.help.is-danger(v-show='isInvalid') This document path is invalid!
        footer
          a.button.is-grey.is-outlined(v-on:click='cancel') Discard
          a.button.is-light-blue(v-on:click='create') Create
</template>

<script>
  import { isEmpty } from 'lodash'
  // import { makeSafePath } from '../helpers/pages'
  import { mapState } from 'vuex'

  export default {
    name: 'modal-create',
    data () {
      return {
        isLoading: false
      }
    },
    computed: mapState('createPage', {
      entrypath: '',
      isShown: 'shown',
      isInvalid: 'invalid'
    }),
    methods: {
      cancel: function () {
        this.$store.dispatch('createPageClose')
      },
      create: function () {
        this.isInvalid = false
        let newDocPath = makeSafePath(this.entrypath)
        if (isEmpty(newDocPath)) {
          this.$store.createPage.commit('')
        } else {
          this.isLoading = true
          window.location.assign('/create/' + newDocPath)
        }
      }
    },
    mounted () {
      // this.entrypath = currentBasePath + '/new-page'
    }
  }
</script>
