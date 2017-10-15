<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-red
              span {{ $t('modal.deletepagetitle') }}
              p.modal-notify(v-bind:class='{ "is-active": isLoading }'): i
            section
              span {{ $t('modal.deletepagewarning') }}
            footer
              a.button.is-grey.is-outlined(v-on:click='discard') {{ $t('modal.discard') }}
              a.button.is-red(v-on:click='deletePage') {{ $t('modal.delete') }}

</template>

<script>
  export default {
    name: 'modal-delete-page',
    props: ['currentPath'],
    data () {
      return {
        isLoading: false
      }
    },
    computed: {
      isShown () {
        return this.$store.state.modalDeletePage.shown
      }
    },
    methods: {
      discard () {
        this.isLoading = false
        this.$store.dispatch('modalDeletePage/close')
      },
      deletePage () {
        let self = this
        this.isLoading = true
        this.$http.delete(window.location.href).then(resp => {
          return resp.json()
        }).then(resp => {
          if (resp.ok) {
            window.location.assign('/')
          } else {
            self.isLoading = false
            self.$store.dispatch('alert', {
              style: 'red',
              icon: 'ui-2_square-remove-09',
              msg: resp.msg
            })
          }
        }).catch(err => {
          self.isLoading = false
          self.$store.dispatch('alert', {
            style: 'red',
            icon: 'ui-2_square-remove-09',
            msg: 'Error: ' + err.body.msg
          })
        })
      }
    }
  }
</script>
