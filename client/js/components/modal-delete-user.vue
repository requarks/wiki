<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            header.is-red
              span {{ $t('modal.deleteusertitle') }}
              p.modal-notify(v-bind:class='{ "is-active": isLoading }'): i
            section
              span {{ $t('modal.deleteuserwarning') }}
            footer
              a.button.is-grey.is-outlined(v-on:click='cancel') {{ $t('modal.abort') }}
              a.button.is-red(v-on:click='deleteUser') {{ $t('modal.delete') }}
</template>

<script>
  export default {
    name: 'modal-delete-user',
    props: ['currentUser'],
    data () {
      return {
        isLoading: false
      }
    },
    computed: {
      isShown () {
        return this.$store.state.modalDeleteUser.shown
      }
    },
    methods: {
      cancel: function () {
        this.isLoading = false
        this.$store.dispatch('modalDeleteUser/close')
      },
      discard: function () {
        let self = this
        this.isLoading = true
        this.$http.delete('/admin/users/' + this.currentUser).then(resp => {
          return resp.json()
        }).then(resp => {
          if (resp.ok) {
            window.location.assign('/admin/users')
          } else {
            self.isLoading = false
            self.$store.dispatch('alert', {
              style: 'red',
              icon: 'square-cross',
              msg: resp.msg
            })
          }
        }).catch(err => {
          self.isLoading = false
          self.$store.dispatch('alert', {
            style: 'red',
            icon: 'square-cross',
            msg: 'Error: ' + err.body.msg
          })
        })
      }
    }
  }
</script>
