<template lang="pug">
  v-app.setup
    v-content
      v-container
        v-layout
          v-flex(xs12, lg6, offset-lg3)
            v-card.radius-7
              .text-center
                img.setup-logo(src='/svg/logo-wikijs.svg', alt='Wiki.js Logo')
              v-alert(tile, color='indigo lighten-5', :value='true')
                v-icon.mr-3(color='indigo') mdi-package-variant
                span.indigo--text You are about to install Wiki.js #[strong {{wikiVersion}}].
              v-card-text
                .overline.pl-3 Create Administrator Account
                v-container.pa-3(grid-list-xl)
                  v-layout(row, wrap)
                    v-flex(xs12)
                      v-text-field(
                        outlined
                        v-model='conf.adminEmail',
                        label='Administrator Email',
                        hint='The email address of the administrator account.',
                        persistent-hint
                        v-validate='{ required: true, email: true }',
                        data-vv-name='adminEmail',
                        data-vv-as='Administrator Email',
                        data-vv-scope='admin',
                        :error-messages='errors.collect(`admin.adminEmail`)'
                        ref='adminEmailInput'
                      )
                    v-flex(xs6)
                      v-text-field(
                        outlined
                        ref='adminPassword',
                        counter='255'
                        v-model='conf.adminPassword',
                        label='Password',
                        :append-icon="pwdMode ? 'mdi-eye-off' : 'mdi-eye'"
                        @click:append="() => (pwdMode = !pwdMode)"
                        :type="pwdMode ? 'password' : 'text'"
                        hint='At least 8 characters long.',
                        persistent-hint
                        v-validate='{ required: true, min: 8 }',
                        data-vv-name='adminPassword',
                        data-vv-as='Password',
                        data-vv-scope='admin',
                        :error-messages='errors.collect(`admin.adminPassword`)'
                      )
                    v-flex(xs6)
                      v-text-field(
                        outlined
                        ref='adminPasswordConfirm',
                        counter='255'
                        v-model='conf.adminPasswordConfirm',
                        label='Confirm Password',
                        :append-icon="pwdConfirmMode ? 'mdi-eye-off' : 'mdi-eye'"
                        @click:append="() => (pwdConfirmMode = !pwdConfirmMode)"
                        :type="pwdConfirmMode ? 'password' : 'text'"
                        hint='Verify your password again.',
                        persistent-hint
                        v-validate='{ required: true, min: 8 }',
                        data-vv-name='adminPasswordConfirm',
                        data-vv-as='Confirm Password',
                        data-vv-scope='admin',
                        :error-messages='errors.collect(`admin.adminPasswordConfirm`)'
                        @keyup.enter='install'
                      )
                v-divider.mb-4
                v-checkbox.ml-3(
                  color='primary',
                  v-model='conf.telemetry',
                  label='Allow Telemetry',
                  persistent-hint,
                  hint='Help Wiki.js developers improve this app with anonymized telemetry.'
                )
              v-alert(:value='error', type='error', icon='warning') {{ errorMessage }}
              v-divider.mt-3(v-if='!error')
              v-card-actions
                v-btn(color='primary', @click='install', :disabled='loading', x-large, flat, block)
                  v-icon(left) mdi-check
                  span Install

    v-dialog(v-model='loading', width='450', persistent)
      v-card(color='primary', dark).radius-7
        v-card-text.text-center.py-5
          .py-3(style='width: 64px; display:inline-block;')
            breeding-rhombus-spinner(
              :animation-duration='2000'
              :size='64'
              color='#FFF'
              )
          template(v-if='!success')
            .subtitle-1.white--text Finalizing your installation...
            .caption Just a moment
          template(v-else)
            .subtitle-1.white--text Installation complete!
            .caption Redirecting...
</template>

<script>
import axios from 'axios'
import _ from 'lodash'
import { BreedingRhombusSpinner } from 'epic-spinners'

export default {
  components: {
    BreedingRhombusSpinner
  },
  props: {
    wikiVersion: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      loading: false,
      success: false,
      error: false,
      errorMessage: '',
      conf: {
        adminEmail: '',
        adminPassword: '',
        adminPasswordConfirm: '',
        telemetry: true
      },
      pwdMode: true,
      pwdConfirmMode: true
    }
  },
  mounted() {
    _.delay(() => {
      this.$refs.adminEmailInput.focus()
    }, 500)
  },
  methods: {
    async install () {
      const validationSuccess = await this.$validator.validateAll('admin')
      if (!validationSuccess || this.conf.adminPassword !== this.conf.adminPasswordConfirm) {
        return
      }

      this.loading = true
      this.success = false
      this.error = false
      this.$forceUpdate()

      _.delay(async () => {
        try {
          const resp = await axios.post('/finalize', this.conf)
          if (resp.data.ok === true) {
            this.success = true
            _.delay(() => {
              window.location.assign('/login')
            }, 3000)
          } else {
            this.error = true
            this.errorMessage = resp.data.error
            this.loading = false
          }
        } catch (err) {
          window.alert(err.message)
        }
      }, 1000)
    }
  }
}

</script>

<style lang='scss'>
.setup {
  .v-application--wrap {
    padding-top: 10vh;
    background-color: darken(mc('grey', '900'), 5%);
    background-image: url(/svg/motif-circuit.svg) !important;
    background-repeat: repeat;
  }

  &-logo {
    width: 300px;
    margin: 3rem 0 2rem 0;
  }
}
</style>
