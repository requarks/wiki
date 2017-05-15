'use strict'

/* global appconfig, runmode */

import jQuery from 'jquery'
import _ from 'lodash'
import Vue from 'vue'
import VeeValidate from 'vee-validate'
import axios from 'axios'

Vue.use(VeeValidate, {
  enableAutoClasses: true,
  classNames: {
    touched: 'is-touched', // the control has been blurred
    untouched: 'is-untouched', // the control hasn't been blurred
    valid: 'is-valid', // model is valid
    invalid: 'is-invalid', // model is invalid
    pristine: 'is-pristine', // control has not been interacted with
    dirty: 'is-dirty' // control has been interacted with
  }
})

jQuery(document).ready(function ($) {
  new Vue({ // eslint-disable-line no-new
    el: 'main',
    data: {
      loading: false,
      state: 'welcome',
      syscheck: {
        ok: false,
        error: '',
        results: []
      },
      dbcheck: {
        ok: false,
        error: ''
      },
      gitcheck: {
        ok: false,
        error: ''
      },
      final: {
        ok: false,
        error: '',
        results: []
      },
      conf: {
        title: appconfig.title || 'Wiki',
        host: appconfig.host || 'http://',
        port: appconfig.port || 80,
        lang: appconfig.lang || 'en',
        public: (appconfig.public === true),
        db: appconfig.db || 'mongodb://localhost:27017/wiki',
        pathData: './data',
        pathRepo: './repo',
        gitUseRemote: (appconfig.git !== false),
        gitUrl: '',
        gitBranch: 'master',
        gitAuthType: 'ssh',
        gitAuthSSHKey: '',
        gitAuthUser: '',
        gitAuthPass: '',
        gitAuthSSL: true,
        gitShowUserEmail: true,
        gitServerEmail: '',
        adminEmail: '',
        adminPassword: '',
        adminPasswordConfirm: ''
      },
      considerations: {
        https: false,
        port: false,
        localhost: false
      }
    },
    computed: {
      currentProgress: function () {
        let perc = '0%'
        switch (this.state) {
          case 'welcome':
            perc = '0%'
            break
          case 'syscheck':
            perc = (this.syscheck.ok) ? '15%' : '5%'
            break
          case 'general':
            perc = '20%'
            break
          case 'considerations':
            perc = '30%'
            break
          case 'db':
            perc = '35%'
            break
          case 'dbcheck':
            perc = (this.dbcheck.ok) ? '50%' : '40%'
            break
          case 'paths':
            perc = '55%'
            break
          case 'git':
            perc = '60%'
            break
          case 'gitcheck':
            perc = (this.gitcheck.ok) ? '75%' : '65%'
            break
          case 'admin':
            perc = '80%'
            break
        }
        return perc
      }
    },
    mounted: function () {
      if (appconfig.paths) {
        this.conf.pathData = appconfig.paths.data || './data'
        this.conf.pathRepo = appconfig.paths.repo || './repo'
      }
      if (appconfig.git !== false && _.isPlainObject(appconfig.git)) {
        this.conf.gitUrl = appconfig.git.url || ''
        this.conf.gitBranch = appconfig.git.branch || 'master'
        this.conf.gitShowUserEmail = (appconfig.git.showUserEmail !== false)
        this.conf.gitServerEmail = appconfig.git.serverEmail || ''
        if (_.isPlainObject(appconfig.git.auth)) {
          this.conf.gitAuthType = appconfig.git.auth.type || 'ssh'
          this.conf.gitAuthSSHKey = appconfig.git.auth.privateKey || ''
          this.conf.gitAuthUser = appconfig.git.auth.username || ''
          this.conf.gitAuthPass = appconfig.git.auth.password || ''
          this.conf.gitAuthSSL = (appconfig.git.auth.sslVerify !== false)
        }
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
        let self = this
        self.state = 'general'
        self.loading = false
        self.$nextTick(() => {
          self.$validator.validateAll('general')
        })
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
        let self = this
        if (runmode.staticMongo) {
          return self.proceedToDbcheck()
        }
        self.state = 'db'
        self.loading = false
        self.$nextTick(() => {
          self.$validator.validateAll('db')
        })
      },
      proceedToDbcheck: function (ev) {
        let self = this
        this.state = 'dbcheck'
        this.loading = true
        self.dbcheck = {
          ok: false,
          error: ''
        }

        _.delay(() => {
          axios.post('/dbcheck', {
            db: self.conf.db
          }).then(resp => {
            if (resp.data.ok === true) {
              self.dbcheck.ok = true
            } else {
              self.dbcheck.ok = false
              self.dbcheck.error = resp.data.error
            }
            self.loading = false
            self.$nextTick()
          }).catch(err => {
            window.alert(err.message)
          })
        }, 1000)
      },
      proceedToPaths: function (ev) {
        let self = this
        self.state = 'paths'
        self.loading = false
        self.$nextTick(() => {
          self.$validator.validateAll('paths')
        })
      },
      proceedToGit: function (ev) {
        let self = this
        self.state = 'git'
        self.loading = false
        self.$nextTick(() => {
          self.$validator.validateAll('git')
        })
      },
      proceedToGitCheck: function (ev) {
        let self = this
        this.state = 'gitcheck'
        this.loading = true
        self.gitcheck = {
          ok: false,
          results: [],
          error: ''
        }

        _.delay(() => {
          axios.post('/gitcheck', self.conf).then(resp => {
            if (resp.data.ok === true) {
              self.gitcheck.ok = true
              self.gitcheck.results = resp.data.results
            } else {
              self.gitcheck.ok = false
              self.gitcheck.error = resp.data.error
            }
            self.loading = false
            self.$nextTick()
          }).catch(err => {
            window.alert(err.message)
          })
        }, 1000)
      },
      proceedToAdmin: function (ev) {
        let self = this
        self.state = 'admin'
        self.loading = false
        self.$nextTick(() => {
          self.$validator.validateAll('admin')
        })
      },
      proceedToFinal: function (ev) {
        let self = this
        self.state = 'final'
        self.loading = true
        self.final = {
          ok: false,
          error: '',
          results: []
        }

        _.delay(() => {
          axios.post('/finalize', self.conf).then(resp => {
            if (resp.data.ok === true) {
              self.final.ok = true
              self.final.results = resp.data.results
            } else {
              self.final.ok = false
              self.final.error = resp.data.error
            }
            self.loading = false
            self.$nextTick()
          }).catch(err => {
            window.alert(err.message)
          })
        }, 1000)
      },
      finish: function (ev) {
        let self = this
        self.state = 'restart'

        _.delay(() => {
          axios.post('/restart', {}).then(resp => {
            _.delay(() => {
              window.location.assign(self.conf.host)
            }, 30000)
          }).catch(err => {
            window.alert(err.message)
          })
        }, 1000)
      }
    }
  })
})
