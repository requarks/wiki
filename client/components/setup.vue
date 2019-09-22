<template lang="pug">
  v-app.setup
    v-content
      v-container
        v-layout
          v-flex(xs12, lg6, offset-lg3)
            v-card.radius-7.animated.fadeInUp
              .text-center
                img.setup-logo.animated.fadeInUp.wait-p2s(src='/svg/logo-wikijs-full.svg', alt='Wiki.js Logo')
              v-alert(v-model='error', type='error', icon='mdi-alert', tile, dismissible) {{ errorMessage }}
              v-alert(v-if='!error', tile, color='indigo lighten-5', :value='true')
                v-icon.mr-3(color='indigo') mdi-package-variant
                span.indigo--text You are about to install Wiki.js #[strong {{wikiVersion}}].
              v-card-text
                .overline.pl-3 Administrator Account
                v-container.pa-3.mt-3(grid-list-xl)
                  v-layout(row, wrap)
                    v-flex(xs12)
                      v-text-field(
                        outlined
                        v-model='conf.adminEmail',
                        label='Administrator Email',
                        hint='The email address of the administrator account.',
                        persistent-hint
                        required
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
              v-divider.mt-2
              v-card-actions
                v-btn(color='primary', @click='install', :disabled='loading', x-large, depressed, block)
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
import _ from 'lodash'
import validate from 'validate.js'
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
      this.error = false

      const validationResults = validate(this.conf, {
        adminEmail: {
          presence: {
            allowEmpty: false
          },
          email: true
        },
        adminPassword: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 6,
            maximum: 255
          }
        },
        adminPasswordConfirm: {
          equality: 'adminPassword'
        }
      }, {
        format: 'flat'
      })
      if (validationResults) {
        this.error = true
        this.errorMessage = validationResults[0]
        this.$forceUpdate()
        return
      }

      this.loading = true
      this.success = false
      this.$forceUpdate()

      _.delay(async () => {
        try {
          const resp = await fetch('/finalize', {
            method: 'POST',
            cache: 'no-cache',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.conf)
          }).then(res => res.json())

          if (resp.ok === true) {
            _.delay(() => {
              this.success = true
              _.delay(() => {
                window.location.assign('/login')
              }, 3000)
            }, 10000)
          } else {
            this.error = true
            this.errorMessage = resp.error
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
    width: 400px;
    margin: 2rem 0 2rem 0;
  }
}
</style>
