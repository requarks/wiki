<template lang="pug">
  .modal(v-bind:class='{ "is-active": isShown }')
    .modal-background
    .modal-container
      .modal-content
        header.is-indigo Move document
        section
          label.label Enter the new document path:
          p.control.is-fullwidth(v-bind:class='{ "is-loading": isLoading }')
            input.input(type='text', placeholder='page-name', v-model='movePath', ref='movePageInput', @keyup.enter='move', @keyup.esc='cancel')
            span.help.is-red(v-show='isInvalid') This document path is invalid or not allowed!
            span.note Note that moving or renaming documents can lead to broken links. Make sure to edit any page that links to this document afterwards!
        footer
          a.button.is-grey.is-outlined(v-on:click='cancel') Discard
          a.button.is-indigo(v-on:click='move') Move
</template>

<script>
  export default {
    name: 'modal-move-page',
    props: ['currentPath'],
    data () {
      return {
        movePath: '',
        isLoading: false,
        isInvalid: false
      }
    },
    computed: {
      isShown () {
        if(this.$store.state.modalMovePage.shown) {
          this.movePath = this.currentPath
          this.makeSelection()
        }
        return this.$store.state.modalMovePage.shown
      }
    },
    methods: {
      makeSelection: function () {
        let self = this;
        self._.delay(() => {
          let startPos = (self._.includes(self.currentPath, '/') ? self._.lastIndexOf(self.movePath, '/') + 1 : 0
          self.$helpers.form.setInputSelection(self.$refs.movePageInput, startPos, self.movePath.length)
        }, 100)
      },
      cancel: function () {
        this.$store.dispatch('modalMovePage/close')
      },
      move: function () {
        this.isInvalid = false
        let newDocPath = this.$helpers.pages.makeSafePath(this.movePath)
        if (this._.isEmpty(newDocPath) || newDocPath === this.currentPath || newDocPath === 'home') {) {
          this.isInvalid = true
        } else {
          this.isLoading = true
          this.$http.put(window.location.href, {
            move: newDocPath
          }).then(resp => {
            return resp.json()
          }).then(resp => {
            if (resp.ok) {
              window.location.assign('/' + newDocPath)
            } else {
              this.loading = false
              self.$store.dispatch('alert', {
                style: 'red',
                icon: 'square-cross',
                msg: resp.msg
              })
            }
          }).catch(err => {
            this.loading = false
            self.$store.dispatch('alert', {
              style: 'red',
              icon: 'square-cross',
              msg: 'Error: ' + err.body.msg
            })
          })
        }
      }
    }
  }
</script>
