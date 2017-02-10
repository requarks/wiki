/* global $, Vue */

// Vue Delete User instance

let vueDeleteUser = new Vue({
  el: '#modal-admin-users-delete',
  data: {

  },
  methods: {
    open: (ev) => {
      $('#modal-admin-users-delete').addClass('is-active')
    },
    cancel: (ev) => {
      $('#modal-admin-users-delete').removeClass('is-active')
    },
    deleteUser: (ev) => {
      vueDeleteUser.cancel()
    }
  }
})

$('.btn-deluser-prompt').on('click', vueDeleteUser.open)
