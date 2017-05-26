<template lang="pug">
  .modal(v-bind:class='{ "is-active": isShown }')
    .modal-background
    .modal-container
      .modal-content
        header.is-light-blue Create New Document
        section
          label.label Enter the new document path:
          p.control.is-fullwidth(v-bind:class='{ "is-loading": isLoading }')
            input.input(type='text', placeholder='page-name', v-model='entrypath', ref='createPageInput', @keyup.enter='create', @keyup.esc='cancel')
            span.help.is-danger(v-show='isInvalid') This document path is invalid!
        footer
          a.button.is-grey.is-outlined(v-on:click='cancel') Discard
          a.button.is-light-blue(v-on:click='create') Create
</template>

<script>
  export default {
    name: 'modal-create-page',
    props: ['basepath'],
    data () {
      return {
        currentPath: '',
        isLoading: false
      }
    },
    computed: {
      entrypath () { return this.$store.state.modalCreatePage.entrypath }
      isShown () {
        if(this.$store.state.modalCreatePage.shown) {
          this.makeSelection()
        }
        return this.$store.state.modalCreatePage.shown
      }
      isInvalid () { return this.$store.state.modalCreatePage.invalid }
    },
    methods: {
      makeSelection: function () {
        let self = this;
        self._.delay(() => {
          let startPos = (self.currentPath.length > 0) ? self.currentPath.length + 1 : 0
          self.$helpers.form.setInputSelection(self.$refs.createPageInput, startPos, self.entrypath.length)
        }, 100)
      },
      cancel: function () {
        this.$store.dispatch('modalCreatePage/close')
      },
      create: function () {
        this.isInvalid = false
        let newDocPath = this.$helpers.pages.makeSafePath(this.entrypath)
        if (this._.isEmpty(newDocPath)) {
          this.$store.createPage.commit('')
        } else {
          this.isLoading = true
          window.location.assign('/create/' + newDocPath)
        }
      }
    },
    mounted () {
      this.currentPath = (this.basepath === 'home') ? '' : this.basepath
      let newPage = (this._.isEmpty(this.currentPath)) ? 'new-page' : this.currentPath + '/new-page'
      this.$store.commit('modalCreatePage/pathChange', newPage)
    }
  }
</script>
