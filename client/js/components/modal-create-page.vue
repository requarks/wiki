<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-light-blue {{ $t('modal.createpagetitle') }}
            section
              label.label {{ $t('modal.createpagepath') }}
              p.control.is-fullwidth(v-bind:class='{ "is-loading": isLoading }')
                input.input(type='text', placeholder='page-name', v-model='userPath', ref='createPageInput', @keyup.enter='create', @keyup.esc='cancel')
                span.help.is-red(v-show='isInvalid') {{ $t('modal.createpageinvalid') }}
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') {{ $t('modal.discard') }}
              a.button.is-light-blue(v-on:click='create') {{ $t('modal.create') }}
</template>

<script>
  export default {
    name: 'modal-create-page',
    props: ['basepath'],
    data () {
      return {
        currentPath: '',
        userPath: '',
        isLoading: false,
        isInvalid: false
      }
    },
    computed: {
      isShown () {
        if(this.$store.state.modalCreatePage.shown) {
          this.makeSelection()
        }
        return this.$store.state.modalCreatePage.shown
      }
    },
    methods: {
      makeSelection: function () {
        let self = this;
        self._.delay(() => {
          let startPos = (self.currentPath.length > 0) ? self.currentPath.length + 1 : 0
          self.$helpers.form.setInputSelection(self.$refs.createPageInput, startPos, self.userPath.length)
        }, 100)
      },
      cancel: function () {
        this.$store.dispatch('modalCreatePage/close')
      },
      create: function () {
        this.isInvalid = false
        let newDocPath = this.$helpers.pages.makeSafePath(this.userPath)
        if (this._.isEmpty(newDocPath)) {
          this.isInvalid = true
        } else {
          this.isLoading = true
          window.location.assign('/create/' + newDocPath)
        }
      }
    },
    mounted () {
      this.currentPath = (this.basepath === 'home') ? '' : this.basepath
      this.userPath = (this._.isEmpty(this.currentPath)) ? 'new-page' : this.currentPath + '/new-page'
    }
  }
</script>
