'use strict'

/* global jQuery, _, Vue, axios */

jQuery(document).ready(function ($) {
  new Vue({ // eslint-disable-line no-new
    el: 'main',
    data: {
      loading: false,
      state: 'considerations',
      syscheck: {
        ok: false,
        error: '',
        results: []
      },
      conf: {
        title: 'Wiki',
        host: '',
        port: 80,
        lang: 'en',
        db: 'mongodb://localhost:27017/wiki'
      },
      considerations: {
        https: false,
        port: false,
        localhost: false
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
        self.syscheck = {
          ok: false,
          error: '',
          results: []
        }

        _.delay(() => {
          axios.post('/syscheck').then(resp => {
            if (resp.data.ok === true) {
              self.syscheck.ok = true
              self.syscheck.results = resp.data.results
            } else {
              self.syscheck.ok = false
              self.syscheck.error = resp.data.error
            }
            self.loading = false
            self.$nextTick()
          }).catch(err => {
            window.alert(err.message)
          })
        }, 1000)
      },
      proceedToGeneral: function (ev) {
        this.state = 'general'
        this.loading = false
      },
      proceedToConsiderations: function (ev) {
        this.considerations = {
          https: !_.startsWith(this.conf.host, 'https'),
          port: false, // TODO
          localhost: _.includes(this.conf.host, 'localhost')
        }
        this.state = 'considerations'
        this.loading = false
      },
      proceedToDb: function (ev) {
        this.state = 'db'
        this.loading = false
      }
    }
  })
})
