'use strict'

import * as $ from 'jquery'

export default {
  name: 'admin-settings',
  data() {
    return {
      upgradeModal: {
        state: false,
        step: 'confirm',
        mode: 'upgrade',
        error: 'Something went wrong.'
      }
    }
  },
  methods: {
    upgrade() {
      this.upgradeModal.mode = 'upgrade'
      this.upgradeModal.step = 'confirm'
      this.upgradeModal.state = true
    },
    reinstall() {
      this.upgradeModal.mode = 're-install'
      this.upgradeModal.step = 'confirm'
      this.upgradeModal.state = true
    },
    upgradeCancel() {
      this.upgradeModal.state = false
    },
    upgradeStart() {
      this.upgradeModal.step = 'running'
      $.post('/admin/settings/install', {
        mode: this.upgradeModal.mode
      }).done((resp) => {
        // todo
      }).fail((jqXHR, txtStatus, resp) => {
        this.upgradeModal.step = 'error'
        this.upgradeModal.error = jqXHR.responseText
      })
    },
    flushcache() {
      window.alert('Coming soon!')
    },
    resetaccounts() {
      window.alert('Coming soon!')
    },
    flushsessions() {
      window.alert('Coming soon!')
    }
  }
}
