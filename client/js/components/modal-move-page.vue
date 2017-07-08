<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-indigo {{ $t('modal.movepagetitle') }}
            section
              label.label {{ $t('modal.movepagepath') }}
              p.control.is-fullwidth(v-bind:class='{ "is-loading": isLoading }')
                input.input(type='text', v-bind:placeholder='$t("modal.movepageplaceholder")', v-model='movePath', ref='movePageInput', @keyup.enter='move', @keyup.esc='cancel')
                span.help.is-red(v-show='isInvalid') {{ $t('modal.movepageinvalid') }}
                span.note {{ $t('modal.movepagewarning') }}
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') {{ $t('modal.discard') }}
              a.button.is-indigo(v-on:click='move') {{ $t('modal.move') }}
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
      makeSelection() {
        let self = this;
        self._.delay(() => {
          let startPos = (self._.includes(self.currentPath, '/')) ? self._.lastIndexOf(self.movePath, '/') + 1 : 0
          self.$helpers.form.setInputSelection(self.$refs.movePageInput, startPos, self.movePath.length)
        }, 100)
      },
      cancel() {
        this.$store.dispatch('modalMovePage/close')
      },
      move () {
        this.isInvalid = false
        let newDocPath = this.$helpers.pages.makeSafePath(this.movePath)
        if (this._.isEmpty(newDocPath) || newDocPath === this.currentPath || newDocPath === 'home') {
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
                icon: 'ui-2_square-remove-09',
                msg: resp.msg
              })
            }
          }).catch(err => {
            this.loading = false
            self.$store.dispatch('alert', {
              style: 'red',
              icon: 'ui-2_square-remove-09',
              msg: 'Error: ' + err.body.msg
            })
          })
        }
      }
    }
  }
</script>
