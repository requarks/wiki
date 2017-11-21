/* global siteConfig */

import axios from 'axios'

export default {
  name: 'configManager',
  data() {
    return {
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
        adminEmail: '',
        adminPassword: '',
        adminPasswordConfirm: '',
        gitAuthPass: '',
        gitAuthSSHKey: '',
        gitAuthSSHKeyEnv: '',
        gitAuthSSHKeyDB: '',
        gitAuthSSL: true,
        gitAuthType: 'ssh',
        gitAuthUser: '',
        gitBranch: 'master',
        gitServerEmail: '',
        gitShowUserEmail: true,
        gitUrl: '',
        gitUseRemote: (siteConfig.git !== false),
        lang: siteConfig.lang || 'en',
        path: siteConfig.path || '/',
        pathRepo: './repo',
        port: siteConfig.port || 80,
        public: (siteConfig.public === true),
        selfregister: (siteConfig.selfregister === true),
        telemetry: true,
        title: siteConfig.title || 'Wiki',
        upgrade: false,
        upgMongo: 'mongodb://'
      },
      considerations: {
        https: false,
        port: false,
        localhost: false
      }
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
          perc = '25%'
          break
        case 'considerations':
          perc = '30%'
          break
        case 'git':
          perc = '50%'
          break
        case 'gitcheck':
          perc = (this.gitcheck.ok) ? '70%' : '55%'
          break
        case 'admin':
          perc = '75%'
          break
        case 'upgrade':
          perc = '85%'
          break
      }
      return perc
    }
  },
  mounted: function () {
    /* if (appconfig.paths) {
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
    } */
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

      this.$helpers._.delay(() => {
        axios.post('/syscheck', self.conf).then(resp => {
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
        https: !this.$helpers._.startsWith(this.conf.host, 'https'),
        port: false, // TODO
        localhost: this.$helpers._.includes(this.conf.host, 'localhost')
      }
      this.state = 'considerations'
      this.loading = false
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

      this.$helpers._.delay(() => {
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
    proceedToUpgrade: function (ev) {
      if (this.conf.upgrade) {
        this.state = 'upgrade'
        this.loading = false
        this.$nextTick(() => {
          this.$validator.validateAll('upgrade')
        })
      } else {
        this.proceedToFinal()
      }
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

      this.$helpers._.delay(() => {
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

      this.$helpers._.delay(() => {
        axios.post('/restart', {}).then(resp => {
          this.$helpers._.delay(() => {
            window.location.assign(self.conf.host)
          }, 30000)
        }).catch(err => {
          window.alert(err.message)
        })
      }, 1000)
    }
  }
}
