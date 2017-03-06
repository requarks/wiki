'use strict'

/* global jQuery, _, Vue, axios */

jQuery(document).ready(function ($) {
  new Vue({ // eslint-disable-line no-new
    el: 'main',
    data: {
      loading: false,
      state: 'welcome',
      syscheck: {
        ok: false,
        error: ''
      },
      conf: {
        title: 'Wiki',
        host: '',
        port: 80,
        lang: 'en',
        db: 'mongodb://localhost:27017/wiki'
      }
    },
    methods: {
      proceedToWelcome: function (ev) {
        this.state = 'welcome'
        this.loading = false
      },
      proceedToSyscheck: function (ev) {
        let self = this
        this.state = 'syscheck'
        this.loading = true

        _.delay(() => {
          axios.post('/syscheck').then(resp => {
            if (resp.data.ok === true) {
              self.syscheck.ok = true
            } else {
              self.syscheck.ok = false
              self.syscheck.error = resp.data.error
            }
            self.loading = false
          }).catch(err => {
            window.alert(err.message)
          })
        }, 1000)
      },
      proceedToGeneral: function (ev) {
        this.state = 'general'
        this.loading = false
      },
      proceedToDb: function (ev) {
        this.state = 'db'
        this.loading = false
      }
    }
  })
})
