<template lang="pug">
  v-app.setup
    v-toolbar(color='blue darken-2', dark, app, clipped-left, fixed, flat)
      v-spacer
      v-toolbar-title
        span.subheading Wiki.js Setup
      v-spacer
    v-content
      v-progress-linear.ma-0(indeterminate, height='4', :active='loading')
      v-stepper.elevation-0(v-model='state')
        v-stepper-header
          v-stepper-step(step='1' :complete='state > 1')
            | Welcome
            small Wiki.js Installation Wizard
          v-divider
          v-stepper-step(step='2' :complete='state > 2')
            | System Check
            small Checking your system for compatibility
          v-divider
          v-stepper-step(step='3' :complete='state > 3')
            | General Information
            small Site Title, Language and Access
          v-divider
          v-stepper-step(step='4' :complete='state > 4')
            | Administration Account
            small Create the admin account
          v-divider(v-if='this.conf.upgrade')
          v-stepper-step(step='5' :complete='state > 5', v-if='this.conf.upgrade')
            | Upgrade from Wiki.js 1.x
            small Migrate your existing installation
          v-divider
          v-stepper-step(:step='this.conf.upgrade ? 6 : 5' :complete='this.conf.upgrade ? state > 5 : state > 6')
            | Final Steps
            small Finalizing your installation

        v-stepper-items
          //- ==============================================
          //- WELCOME
          //- ==============================================

          v-stepper-content(step='1')
            v-card.text-xs-center.pa-3(flat)
              img(src='/svg/logo-wikijs.svg', alt='Wiki.js Logo', style='width: 300px;')
            v-container
              .body-2.py-2 This installation wizard will guide you through the steps needed to get your wiki up and running in no time!
              .body-1
                | Detailed information about installation and usage can be found on the #[a(href='https://wiki.requarks.io/docs') official documentation site].
                br
                | Should you have any question or would like to report something that doesn't look right, feel free to create a new issue on the #[a(href='https://github.com/Requarks/wiki/issues') GitHub project].
              .body-1.pt-3
                svg.icons.is-18.is-outlined.has-right-pad.is-text: use(xlink:href='#nc-cd-reader')
                span You are about to install Wiki.js #[strong {{wikiVersion}}].
              v-divider
              v-form
                v-checkbox(
                  color='primary',
                  v-model='conf.telemetry',
                  label='Allow Telemetry',
                  persistent-hint,
                  hint='Help Wiki.js developers improve this app with anonymized telemetry.'
                )
                v-checkbox.mt-3(
                  color='primary',
                  v-model='conf.upgrade',
                  label='Upgrade from Wiki.js 1.x',
                  persistent-hint,
                  hint='Check this box if you are upgrading from Wiki.js 1.x and wish to migrate your existing data.'
                )
            v-divider
            .text-xs-center
              v-btn(color='primary', @click='proceedToSyscheck', :disabled='loading') Start

          //- ==============================================
          //- SYSTEM CHECK
          //- ==============================================

          v-stepper-content(step='2')
            v-card.text-xs-center(flat)
              svg.icons.is-64: use(xlink:href='#nc-metrics')
              .subheading System Check
            v-container
              v-layout(row, align-center, v-if='loading')
                v-progress-circular(v-if='loading', indeterminate, color='blue')
                .body-2.blue--text.ml-3 Checking your system for compatibility...
              v-alert(type='success', outline, :value='!loading && syscheck.ok') Looks good! No issues so far.
              v-alert(type='error', outline, :value='!loading && !syscheck.ok') {{ syscheck.error }}
              v-list.mt-3(two-line, v-if='!loading && syscheck.ok', dense)
                template(v-for='(rs, n) in syscheck.results')
                  v-divider(v-if='n > 0', inset)
                  v-list-tile
                    v-list-tile-avatar(color='green lighten-5')
                      v-icon(color='green') check
                    v-list-tile-content
                      v-list-tile-title {{rs.title}}
                      v-list-tile-sub-title {{rs.subtitle}}
            v-divider
            .text-xs-center
              v-btn(@click='proceedToWelcome', :disabled='loading') Back
              v-btn(color='primary', @click='proceedToSyscheck', v-if='!loading && !syscheck.ok') Check Again
              v-btn(color='red', dark, @click='proceedToGeneral', v-if='!loading && !syscheck.ok') Continue Anyway
              v-btn(color='primary', @click='proceedToGeneral', v-if='loading || syscheck.ok', :disabled='loading') Continue

          //- ==============================================
          //- GENERAL
          //- ==============================================

          v-stepper-content(step='3')
            v-card.text-xs-center(flat)
              svg.icons.is-64: use(xlink:href='#nc-webpage')
              .subheading General Information
            v-form
              v-container
                v-layout(row, wrap)
                  v-flex(xs12, sm6).pr-3
                    v-text-field(
                      v-model='conf.title',
                      label='Site Title',
                      :counter='255',
                      persistent-hint,
                      hint='The site title will appear in the top left corner on every page and within the window title bar.',
                      v-validate='{ required: true, min: 2 }',
                      data-vv-name='siteTitle',
                      data-vv-as='Site Title',
                      data-vv-scope='general',
                      :error-messages='errors.collect(`siteTitle`)'
                    )
                  v-flex.pr-3(xs12, sm6)
                    v-text-field(
                      v-model='conf.port',
                      label='Server Port',
                      persistent-hint,
                      hint='The port on which Wiki.js will listen to. Usually port 80 if connecting directly, or a random port (e.g. 3000) if using a web server in front of it. Set $(PORT) to use the PORT environment variable.',
                      v-validate='{ required: true }',
                      data-vv-name='port',
                      data-vv-as='Port',
                      data-vv-scope='general',
                      :error-messages='errors.collect(`port`)'
                    )
                v-layout(row, wrap).mt-3
                  v-flex(xs12, sm6).pr-3
                    v-text-field(
                      v-model='conf.pathContent',
                      label='Content Data Path',
                      persistent-hint,
                      hint='The path where content is stored (markdown files, uploads, etc.)',
                      v-validate='{ required: true, min: 2 }',
                      data-vv-name='pathContent',
                      data-vv-as='Content Data Path',
                      data-vv-scope='general',
                      :error-messages='errors.collect(`pathContent`)'
                    )
                  v-flex(xs12, sm6)
                    v-text-field(
                      v-model='conf.pathData',
                      label='Temporary Data Path',
                      persistent-hint,
                      hint='The path where temporary data is stored (cache, thumbnails, temporary upload files, etc.)',
                      v-validate='{ required: true, min: 2 }',
                      data-vv-name='pathData',
                      data-vv-as='Temporary Data Path',
                      data-vv-scope='general',
                      :error-messages='errors.collect(`pathData`)'
                    )
                v-layout(row, wrap).mt-3
                  v-flex(xs12)
                    v-checkbox(
                      color='primary',
                      v-model='conf.public',
                      label='Public Access',
                      persistent-hint,
                      hint='Should the site be accessible (read only) without login.'
                    )
                    v-checkbox.mt-2(
                      color='primary',
                      v-model='conf.selfRegister',
                      label='Allow Self-Registration',
                      persistent-hint,
                      hint='Can users create their own account to gain access?'
                    )
            v-divider
            .text-xs-center
              v-btn(@click='proceedToSyscheck', :disabled='loading') Back
              v-btn(color='primary', @click='proceedToAdmin', :disabled='loading') Continue

          //- ==============================================
          //- ADMINISTRATOR ACCOUNT
          //- ==============================================

          v-stepper-content(step='4')
            v-card.text-xs-center(flat)
              svg.icons.is-64: use(xlink:href='#nc-man-black')
              .subheading Administrator Account
              .body-2 A root administrator account will be created for local authentication. From this account, you can create or authorize more users.
            v-form
              v-container
                v-layout(row, wrap)
                  v-flex(xs12)
                    v-text-field(
                      autofocus
                      v-model='conf.adminEmail',
                      label='Administrator Email',
                      hint='The email address of the administrator account',
                      v-validate='{ required: true, email: true }',
                      data-vv-name='adminEmail',
                      data-vv-as='Administrator Email',
                      data-vv-scope='admin',
                      :error-messages='errors.collect(`adminEmail`)'
                    )
                  v-flex.pr-3(xs6)
                    v-text-field(
                      ref='adminPassword',
                      v-model='conf.adminPassword',
                      label='Password',
                      hint='At least 8 characters long.',
                      v-validate='{ required: true, min: 8 }',
                      data-vv-name='adminPassword',
                      data-vv-as='Password',
                      data-vv-scope='admin',
                      :error-messages='errors.collect(`adminPassword`)'
                    )
                  v-flex(xs6)
                    v-text-field(
                      ref='adminPasswordConfirm',
                      v-model='conf.adminPasswordConfirm',
                      label='Confirm Password',
                      hint='Verify your password again.',
                      v-validate='{ required: true, min: 8 }',
                      data-vv-name='adminPasswordConfirm',
                      data-vv-as='Confirm Password',
                      data-vv-scope='admin',
                      :error-messages='errors.collect(`adminPasswordConfirm`)'
                    )
              .text-xs-center
                v-btn(@click='proceedToGeneral', :disabled='loading') Back
                v-btn(color='primary', @click='proceedToUpgrade', :disabled='loading') Continue

          //- ==============================================
          //- UPGRADE FROM 1.x
          //- ==============================================

          v-stepper-content(step='5', v-if='conf.upgrade')
            v-card.text-xs-center(flat)
              svg.icons.is-64: use(xlink:href='#nc-spaceship')
              .subheading Upgrade from Wiki.js 1.x
              .body-2 Migrating from a Wiki.js 1.x installation is quick and simple.
            v-form
              v-container
                v-layout(row)
                  v-flex(xs12)
                    v-text-field(
                      v-model='conf.upgMongo',
                      placeholder='mongodb://',
                      label='Connection String to Wiki.js 1.x MongoDB database',
                      persistent-hint,
                      hint='A MongoDB database connection string where a Wiki.js 1.x installation is located. No alterations will be made to this database.',
                      v-validate='{ required: true, min: 2 }',
                      data-vv-name='upgMongo',
                      data-vv-as='MongoDB Connection String',
                      data-vv-scope='upgrade',
                      :error-messages='errors.collect(`upgMongo`)'
                    )
            .text-xs-center
              v-btn(@click='proceedToAdmin', :disabled='loading') Back
              v-btn(color='primary', @click='proceedToFinal', :disabled='loading') Continue

          //- ==============================================
          //- FINAL
          //- ==============================================

          v-stepper-content(:step='conf.upgrade ? 6 : 5')
            v-card.text-xs-center(flat)
              template(v-if='loading')
                v-progress-circular(size='64', indeterminate, color='blue')
                .subheading Finalizing your installation...
              template(v-else-if='final.ok')
                svg.icons.is-64: use(xlink:href='#nc-check-bold')
                .subheading Installation complete!
              template(v-else)
                svg.icons.is-64: use(xlink:href='#nc-square-remove')
                .subheading Something went wrong...
            v-container
              v-alert(type='success', outline, :value='!loading && final.ok') Wiki.js was configured successfully and is now ready for use.
              v-alert(type='error', outline, :value='!loading && !final.ok') {{ final.error }}
            v-divider
            .text-xs-center
              v-btn(@click='!conf.upgrade ? proceedToAdmin() : proceedToUpgrade()', :disabled='loading') Back
              v-btn(color='primary', @click='proceedToFinal', v-if='!loading && !final.ok') Try Again
              v-btn(color='success', @click='finish', v-if='loading || final.ok', :disabled='loading') Continue

    v-footer.pa-3(app, absolute, color='grey darken-3', height='auto')
      .caption.grey--text Wiki.js
      v-spacer
      .caption.grey--text(v-if='conf.telemetry') Telemetry Client ID: {{telemetryId}}
</template>

<script>

/* global siteConfig */

import axios from 'axios'
import _ from 'lodash'

export default {
  props: {
    telemetryId: {
      type: String,
      required: true
    },
    wikiVersion: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      state: 1,
      syscheck: {
        ok: false,
        error: '',
        results: []
      },
      final: {
        ok: false,
        error: '',
        redirectUrl: ''
      },
      conf: {
        adminEmail: '',
        adminPassword: '',
        adminPasswordConfirm: '',
        lang: siteConfig.lang || 'en',
        pathData: './data',
        pathContent: './content',
        port: siteConfig.port || 80,
        public: (siteConfig.public === true),
        selfRegister: (siteConfig.selfRegister === true),
        telemetry: true,
        title: siteConfig.title || 'Wiki',
        upgrade: false,
        upgMongo: 'mongodb://'
      }
    }
  },
  methods: {
    proceedToWelcome () {
      this.state = 1
      this.loading = false
    },
    proceedToSyscheck () {
      let self = this
      this.state = 2
      this.loading = true
      this.syscheck = {
        ok: false,
        error: '',
        results: []
      }

      _.delay(() => {
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
    proceedToGeneral () {
      this.state = 3
      this.loading = false
    },
    async proceedToAdmin () {
      if (this.state < 4) {
        const validationSuccess = await this.$validator.validateAll('general')
        if (!validationSuccess) {
          this.state = 3
          return
        }
      }
      this.state = 4
      this.loading = false
    },
    async proceedToUpgrade () {
      if (this.state < 5) {
        const validationSuccess = await this.$validator.validateAll('admin')
        if (!validationSuccess || this.conf.adminPassword !== this.conf.adminPasswordConfirm) {
          this.state = 4
          return
        }
      }

      if (this.conf.upgrade) {
        this.state = 5
        this.loading = false
      } else {
        this.proceedToFinal()
      }
    },
    async proceedToFinal () {
      if (this.conf.upgrade && this.state < 6) {
        const validationSuccess = await this.$validator.validateAll('upgrade')
        if (!validationSuccess) {
          this.state = 5
          return
        }
      }

      this.state = this.conf.upgrade ? 6 : 5
      this.loading = true
      this.final = {
        ok: false,
        error: '',
        redirectUrl: ''
      }
      this.$forceUpdate()
      let self = this

      _.delay(() => {
        axios.post('/finalize', self.conf).then(resp => {
          if (resp.data.ok === true) {
            _.delay(() => {
              self.final.ok = true
              switch (resp.data.redirectPort) {
                case 80:
                  self.final.redirectUrl = `http://${window.location.hostname}${resp.data.redirectPath}/login`
                  break
                case 443:
                  self.final.redirectUrl = `https://${window.location.hostname}${resp.data.redirectPath}/login`
                  break
                default:
                  self.final.redirectUrl = `http://${window.location.hostname}:${resp.data.redirectPort}${resp.data.redirectPath}/login`
                  break
              }
              self.loading = false
            }, 5000)
          } else {
            self.final.ok = false
            self.final.error = resp.data.error
            self.loading = false
          }
          self.$nextTick()
        }).catch(err => {
          window.alert(err.message)
        })
      }, 1000)
    },
    finish () {
      window.location.assign(this.final.redirectUrl)
    }
  }
}

</script>

<style lang='scss'>

</style>
