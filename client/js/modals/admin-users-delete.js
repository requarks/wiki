'use strict'

/* global usrData */

'use strict'

import $ from 'jquery'
import Vue from 'vue'

// Vue Delete User instance

module.exports = (alerts) => {
  let vueDeleteUser = new Vue({
    el: '#modal-admin-users-delete',
    data: {
      loading: false
    },
    methods: {
      open: (ev) => {
        $('#modal-admin-users-delete').addClass('is-active')
      },
      cancel: (ev) => {
        $('#modal-admin-users-delete').removeClass('is-active')
      },
      deleteUser: (ev) => {
        vueDeleteUser.loading = true
        $.ajax('/admin/users/' + usrData._id, {
          dataType: 'json',
          method: 'DELETE'
        }).then((rData, rStatus, rXHR) => {
          vueDeleteUser.loading = false
          vueDeleteUser.cancel()
          window.location.assign('/admin/users')
        }, (rXHR, rStatus, err) => {
          vueDeleteUser.loading = false
          alerts.pushError('Error', rXHR.responseJSON.msg)
        })
      }
    }
  })

  $('.btn-deluser-prompt').on('click', vueDeleteUser.open)
}
