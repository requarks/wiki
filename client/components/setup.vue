<template lang="pug">
  v-app.setup
    v-toolbar(color='blue darken-2', dark, app, clipped-left, fixed, flat)
      v-spacer
      v-toolbar-title
        span.subheading Wiki.js {{wikiVersion}}
      v-spacer
    v-content.white
      v-progress-linear.ma-0(indeterminate, height='4', :active='loading')
      v-stepper.elevation-0(v-model='state')
        v-stepper-header
          v-stepper-step(step='1' :complete='state > 1')
            | Welcome
            small Wiki.js Installation Wizard
          v-divider
          v-stepper-step(step='2' :complete='state > 2')
            | Administration Account
            small Create the admin account
          v-divider(v-if='this.conf.upgrade')
          v-stepper-step(step='3' :complete='state > 3', v-if='this.conf.upgrade')
            | Upgrade from Wiki.js 1.x
            small Migrate your existing installation
          v-divider
          v-stepper-step(:step='this.conf.upgrade ? 4 : 3' :complete='this.conf.upgrade ? state > 3 : state > 4')
            | Final Steps
            small Finalizing your installation

        v-stepper-items
          //- ==============================================
          //- WELCOME
          //- ==============================================

          v-stepper-content(step='1')
            v-card.text-xs-center.pa-3(flat)
              img(src='/svg/logo-wikijs.svg', alt='Wiki.js Logo', style='width: 300px;')
            .text-xs-center
              .body-2.py-2 This installation wizard will guide you through the steps needed to get your wiki up and running in no time!
              .body-1 Detailed information about installation and usage can be found on the #[a(href='https://wiki.requarks.io/docs') official documentation site].
              .body-1 Should you have any question or would like to report something that doesn't look right, feel free to create a new issue on the #[a(href='https://github.com/Requarks/wiki/issues') GitHub project].
              .body-1.py-3
                v-icon.mr-2(color='indigo') open_in_browser
                span.indigo--text You are about to install Wiki.js #[strong {{wikiVersion}}].
              v-btn.mt-4(color='primary', @click='proceedToAdmin', :disabled='loading', large)
                span Start
                v-icon(right) arrow_forward
              v-divider.my-5
              .body-2 Additional Setup Options
              div(style='display:inline-block;')
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
                  disabled
                  persistent-hint,
                  hint='Check this box if you are upgrading from Wiki.js 1.x and wish to migrate your existing data.'
                )

          //- ==============================================
          //- ADMINISTRATOR ACCOUNT
          //- ==============================================

          v-stepper-content(step='2')
            v-card.text-xs-center(flat)
              svg.icons.is-64: use(xlink:href='#nc-man-black')
              .subheading Administrator Account
              .body-2 A root administrator account will be created for local authentication. From this account, you can create or authorize more users.
            v-form
              v-container
                v-layout(row, wrap)
                  v-flex(xs12)
                    v-text-field(
                      outline
                      background-color='grey lighten-2'
                      v-model='conf.adminEmail',
                      label='Administrator Email',
                      hint='The email address of the administrator account',
                      persistent-hint
                      v-validate='{ required: true, email: true }',
                      data-vv-name='adminEmail',
                      data-vv-as='Administrator Email',
                      data-vv-scope='admin',
                      :error-messages='errors.collect(`adminEmail`)'
                      ref='adminEmailInput'
                    )
                  v-flex.pr-3(xs6)
                    v-text-field(
                      outline
                      background-color='grey lighten-2'
                      ref='adminPassword',
                      counter='255'
                      v-model='conf.adminPassword',
                      label='Password',
                      :append-icon="pwdMode ? 'visibility' : 'visibility_off'"
                      @click:append="() => (pwdMode = !pwdMode)"
                      :type="pwdMode ? 'password' : 'text'"
                      hint='At least 8 characters long.',
                      persistent-hint
                      v-validate='{ required: true, min: 8 }',
                      data-vv-name='adminPassword',
                      data-vv-as='Password',
                      data-vv-scope='admin',
                      :error-messages='errors.collect(`adminPassword`)'
                    )
                  v-flex(xs6)
                    v-text-field(
                      outline
                      background-color='grey lighten-2'
                      ref='adminPasswordConfirm',
                      counter='255'
                      v-model='conf.adminPasswordConfirm',
                      label='Confirm Password',
                      :append-icon="pwdConfirmMode ? 'visibility' : 'visibility_off'"
                      @click:append="() => (pwdConfirmMode = !pwdConfirmMode)"
                      :type="pwdConfirmMode ? 'password' : 'text'"
                      hint='Verify your password again.',
                      persistent-hint
                      v-validate='{ required: true, min: 8 }',
                      data-vv-name='adminPasswordConfirm',
                      data-vv-as='Confirm Password',
                      data-vv-scope='admin',
                      :error-messages='errors.collect(`adminPasswordConfirm`)'
                      @keyup.enter='proceedToUpgrade'
                    )
              .pt-3.text-xs-center
                v-btn(@click='proceedToWelcome', :disabled='loading') Back
                v-btn(color='primary', @click='proceedToUpgrade', :disabled='loading') Continue

          //- ==============================================
          //- UPGRADE FROM 1.x
          //- ==============================================

          v-stepper-content(step='3', v-if='conf.upgrade')
            v-card.text-xs-center(flat)
              svg.icons.is-64: use(xlink:href='#nc-spaceship')
              .subheading Upgrade from Wiki.js 1.x
              .body-2 Migrating from a Wiki.js 1.x installation is quick and simple.
            v-form
              v-container
                v-layout(row)
                  v-flex(xs12)
                    v-text-field(
                      outline
                      background-color='grey lighten-2'
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
            .pt-3.text-xs-center
              v-btn(@click='proceedToAdmin', :disabled='loading') Back
              v-btn(color='primary', @click='proceedToFinal', :disabled='loading') Continue

          //- ==============================================
          //- FINAL
          //- ==============================================

          v-stepper-content(:step='conf.upgrade ? 4 : 3')
            v-card.text-xs-center(flat)
              template(v-if='loading')
                .mt-3(style='width: 64px; display:inline-block;')
                  atom-spinner(
                    :animation-duration='800'
                    :size='64'
                    color='#1976d2'
                    )
                .subheading.primary--text.mt-3 Finalizing your installation...
              template(v-else-if='final.ok')
                svg.icons.is-64: use(xlink:href='#nc-check-bold')
                .subheading.green--text Installation complete!
              template(v-else)
                svg.icons.is-64: use(xlink:href='#nc-square-remove')
                .subheading.red--text Something went wrong...
            v-container
              v-alert(type='success', outline, :value='!loading && final.ok') Wiki.js was configured successfully and is now ready for use.
              v-alert(type='error', outline, :value='!loading && !final.ok') {{ final.error }}
            v-divider
            .pt-3.text-xs-center
              v-btn(@click='!conf.upgrade ? proceedToAdmin() : proceedToUpgrade()', :disabled='loading') Back
              v-btn(color='primary', @click='proceedToFinal', v-if='!loading && !final.ok') Try Again
              v-btn(color='success', @click='finish', v-if='loading || final.ok', :disabled='loading') Continue

    v-footer.pa-3(app, absolute, color='grey darken-3', height='auto')
      .caption.grey--text Wiki.js {{wikiVersion}} Installation Wizard
</template>

<script>
import axios from 'axios'
import _ from 'lodash'
import { AtomSpinner } from 'epic-spinners'

export default {
  components: {
    AtomSpinner
  },
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
      final: {
        ok: false,
        error: '',
        redirectUrl: ''
      },
      conf: {
        adminEmail: '',
        adminPassword: '',
        adminPasswordConfirm: '',
        telemetry: true,
        upgrade: false,
        upgMongo: 'mongodb://'
      },
      pwdMode: true,
      pwdConfirmMode: true
    }
  },
  methods: {
    proceedToWelcome () {
      this.state = 1
      this.loading = false
    },
    async proceedToAdmin () {
      if (this.state < 2) {
        const validationSuccess = await this.$validator.validateAll('general')
        if (!validationSuccess) {
          this.state = 1
          return
        }
      }
      this.state = 2
      this.loading = false
      _.delay(() => {
        this.$refs.adminEmailInput.focus()
      }, 400)
    },
    async proceedToUpgrade () {
      if (this.state < 3) {
        const validationSuccess = await this.$validator.validateAll('admin')
        if (!validationSuccess || this.conf.adminPassword !== this.conf.adminPasswordConfirm) {
          this.state = 2
          return
        }
      }

      if (this.conf.upgrade) {
        this.state = 3
        this.loading = false
      } else {
        this.proceedToFinal()
      }
    },
    async proceedToFinal () {
      if (this.conf.upgrade && this.state < 4) {
        const validationSuccess = await this.$validator.validateAll('upgrade')
        if (!validationSuccess) {
          this.state = 3
          return
        }
      }

      this.state = this.conf.upgrade ? 4 : 3
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
      window.location.assign('/login')
    }
  }
}

</script>

<style lang='scss'>

</style>
