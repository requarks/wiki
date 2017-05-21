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
          a.button.is-grey.is-outlined(v-on:click='hide') Discard
          a.button.is-light-blue(v-on:click='create') Create
</template>

<script>
  import * as _ from 'lodash'
  import { makeSafePath } from '../helpers/pages'

  export default {
    name: 'modal-create',
    data () {
      return {
        entrypath: ''
        isInvalid: false,
        isLoading: false,
        isShown: false
      }
    },
    methods: {
      show: function () {
        this.isInvalid = false
        this.shown = true
      },
      hide: function () {
        this.shown = false
      },
      create: function () {
        this.isInvalid = false
        let newDocPath = makeSafePath(this.entrypath)
        if (_.isEmpty(newDocPath)) {
          this.isInvalid = true
        } else {
          $('#txt-create-prompt').parent().addClass('is-loading')
          window.location.assign('/create/' + newDocPath)
        }
      }
    },
    mounted () {
      this.entrypath = currentBasePath + '/new-page'
    }
  }
</script>
