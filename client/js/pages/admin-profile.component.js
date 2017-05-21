'use strict'

import * as $ from 'jquery'

export default {
  name: 'admin-profile',
  props: ['email', 'name', 'provider'],
  data() {
    return {
      password: '********',
      passwordVerify: '********'
    }
  },
  methods: {
    saveUser() {
      if (this.password !== this.passwordVerify) {
        //alerts.pushError('Error', "Passwords don't match!")
        return
      }
      $.post(window.location.href, {
        password: this.password,
        name: this.name
      }).done((resp) => {
        //alerts.pushSuccess('Saved successfully', 'Changes have been applied.')
      }).fail((jqXHR, txtStatus, resp) => {
        //alerts.pushError('Error', resp)
      })
    }
  }
}
