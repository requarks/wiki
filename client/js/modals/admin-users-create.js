'use strict'

import $ from 'jquery'
import Vue from 'vue'

// Vue Create User instance

module.exports = (alerts) => {
  let vueCreateUser = new Vue({
    el: '#modal-admin-users-create',
    data: {
      email: '',
      provider: 'local',
      password: '',
      name: '',
      loading: false
    },
    methods: {
      open: (ev) => {
        $('#modal-admin-users-create').addClass('is-active')
        $('#modal-admin-users-create input').first().focus()
      },
      cancel: (ev) => {
        $('#modal-admin-users-create').removeClass('is-active')
        vueCreateUser.email = ''
        vueCreateUser.provider = 'local'
      },
      create: (ev) => {
        vueCreateUser.loading = true
        $.ajax('/admin/users/create', {
          data: {
            email: vueCreateUser.email,
            provider: vueCreateUser.provider,
            password: vueCreateUser.password,
            name: vueCreateUser.name
          },
          dataType: 'json',
          method: 'POST'
        }).then((rData, rStatus, rXHR) => {
          vueCreateUser.loading = false
          if (rData.ok) {
            vueCreateUser.cancel()
            window.location.reload(true)
          } else {
            alerts.pushError('Something went wrong', rData.msg)
          }
        }, (rXHR, rStatus, err) => {
          vueCreateUser.loading = false
          alerts.pushError('Error', rXHR.responseJSON.msg)
        })
      }
    }
  })

  $('.btn-create-prompt').on('click', vueCreateUser.open)
}
