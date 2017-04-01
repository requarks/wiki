'use strict'

/* global usrData, usrDataName */

import $ from 'jquery'
import _ from 'lodash'
import Vue from 'vue'

module.exports = (alerts) => {
  if ($('#page-type-admin-profile').length) {
    let vueProfile = new Vue({
      el: '#page-type-admin-profile',
      data: {
        password: '********',
        passwordVerify: '********',
        name: ''
      },
      methods: {
        saveUser: (ev) => {
          if (vueProfile.password !== vueProfile.passwordVerify) {
            alerts.pushError('Error', "Passwords don't match!")
            return
          }
          $.post(window.location.href, {
            password: vueProfile.password,
            name: vueProfile.name
          }).done((resp) => {
            alerts.pushSuccess('Saved successfully', 'Changes have been applied.')
          }).fail((jqXHR, txtStatus, resp) => {
            alerts.pushError('Error', resp)
          })
        }
      },
      created: function () {
        this.name = usrDataName
      }
    })
  } else if ($('#page-type-admin-users').length) {
    require('../modals/admin-users-create.js')(alerts)
  } else if ($('#page-type-admin-users-edit').length) {
    let vueEditUser = new Vue({
      el: '#page-type-admin-users-edit',
      data: {
        id: '',
        email: '',
        password: '********',
        name: '',
        rights: [],
        roleoverride: 'none'
      },
      methods: {
        addRightsRow: (ev) => {
          vueEditUser.rights.push({
            role: 'write',
            path: '/',
            exact: false,
            deny: false
          })
        },
        removeRightsRow: (idx) => {
          _.pullAt(vueEditUser.rights, idx)
          vueEditUser.$forceUpdate()
        },
        saveUser: (ev) => {
          let formattedRights = _.cloneDeep(vueEditUser.rights)
          switch (vueEditUser.roleoverride) {
            case 'admin':
              formattedRights.push({
                role: 'admin',
                path: '/',
                exact: false,
                deny: false
              })
              break
          }
          $.post(window.location.href, {
            password: vueEditUser.password,
            name: vueEditUser.name,
            rights: JSON.stringify(formattedRights)
          }).done((resp) => {
            alerts.pushSuccess('Saved successfully', 'Changes have been applied.')
          }).fail((jqXHR, txtStatus, resp) => {
            alerts.pushError('Error', resp)
          })
        }
      },
      created: function () {
        this.id = usrData._id
        this.email = usrData.email
        this.name = usrData.name

        if (_.find(usrData.rights, { role: 'admin' })) {
          this.rights = _.reject(usrData.rights, ['role', 'admin'])
          this.roleoverride = 'admin'
        } else {
          this.rights = usrData.rights
        }
      }
    })
    require('../modals/admin-users-delete.js')(alerts)
  } else if ($('#page-type-admin-settings').length) {
    let vueSettings = new Vue({ // eslint-disable-line no-unused-vars
      el: '#page-type-admin-settings',
      data: {
        upgradeModal: {
          state: false,
          step: 'confirm',
          mode: 'upgrade',
          error: 'Something went wrong.'
        }
      },
      methods: {
        upgrade: (ev) => {
          vueSettings.upgradeModal.mode = 'upgrade'
          vueSettings.upgradeModal.step = 'confirm'
          vueSettings.upgradeModal.state = true
        },
        reinstall: (ev) => {
          vueSettings.upgradeModal.mode = 're-install'
          vueSettings.upgradeModal.step = 'confirm'
          vueSettings.upgradeModal.state = true
        },
        upgradeCancel: (ev) => {
          vueSettings.upgradeModal.state = false
        },
        upgradeStart: (ev) => {
          vueSettings.upgradeModal.step = 'running'
          $.post('/admin/settings/install', {
            mode: vueSettings.upgradeModal.mode
          }).done((resp) => {
            // todo
          }).fail((jqXHR, txtStatus, resp) => {
            vueSettings.upgradeModal.step = 'error'
            vueSettings.upgradeModal.error = jqXHR.responseText
          })
        },
        flushcache: (ev) => {
          window.alert('Coming soon!')
        },
        resetaccounts: (ev) => {
          window.alert('Coming soon!')
        },
        flushsessions: (ev) => {
          window.alert('Coming soon!')
        }
      }
    })
  }
}
