<template lang="pug">
  v-app
    .register
      v-container(grid-list-lg)
        v-layout(row, wrap)
          v-flex(
            xs12
            offset-sm1, sm10
            offset-md2, md8
            offset-lg3, lg6
            offset-xl4, xl4
            )
            transition(name='fadeUp')
              v-card.elevation-5.md2(v-show='isShown')
                v-toolbar(color='indigo', flat, dense, dark)
                  v-spacer
                  .subheading {{ $t('auth:registerTitle') }}
                  v-spacer
                v-card-text.text-center
                  h1.display-1.indigo--text.py-2 {{ siteTitle }}
                  .body-2 {{ $t('auth:registerSubTitle') }}
                  v-text-field.md2.mt-3(
                    solo
                    flat
                    prepend-icon='mdi-email'
                    background-color='grey lighten-4'
                    hide-details
                    ref='iptEmail'
                    v-model='email'
                    :placeholder='$t("auth:fields.email")'
                    color='indigo'
                    )
                  v-text-field.md2.mt-2(
                    solo
                    flat
                    prepend-icon='mdi-textbox-password'
                    background-color='grey lighten-4'
                    ref='iptPassword'
                    v-model='password'
                    :append-icon='hidePassword ? "mdi-eye-off" : "mdi-eye"'
                    @click:append='() => (hidePassword = !hidePassword)'
                    :type='hidePassword ? "password" : "text"'
                    :placeholder='$t("auth:fields.password")'
                    color='indigo'
                    loading
                    counter='255'
                    )
                    password-strength(slot='progress', v-model='password')
                  v-text-field.md2.mt-2(
                    solo
                    flat
                    prepend-icon='mdi-textbox-password'
                    background-color='grey lighten-4'
                    hide-details
                    ref='iptVerifyPassword'
                    v-model='verifyPassword'
                    @click:append='() => (hidePassword = !hidePassword)'
                    type='password'
                    :placeholder='$t("auth:fields.verifyPassword")'
                    color='indigo'
                  )
                  v-text-field.md2.mt-2(
                    solo
                    flat
                    prepend-icon='mdi-account'
                    background-color='grey lighten-4'
                    ref='iptName'
                    v-model='name'
                    :placeholder='$t("auth:fields.name")'
                    @keyup.enter='register'
                    color='indigo'
                    counter='255'
                    )
                v-card-actions.pb-4
                  v-spacer
                  v-btn.md2(
                    width='100%'
                    max-width='250px'
                    large
                    dark
                    color='indigo'
                    @click='register'
                    rounded
                    :loading='isLoading'
                    ) {{ $t('auth:actions.register') }}
                  v-spacer
                v-divider
                v-card-actions.py-3.grey.lighten-4
                  v-spacer
                  i18next.caption(path='auth:switchToLogin.text', tag='div')
                    a.caption(href='/login', place='link') {{ $t('auth:switchToLogin.link') }}
                  v-spacer

    loader(v-model='isLoading', :mode='loaderMode', :icon='loaderIcon', :color='loaderColor', :title='loaderTitle', :subtitle='loaderSubtitle')
    nav-footer(color='grey darken-4', dark-color='grey darken-4')
    notify
</template>

<script>
/* global siteConfig */

import _ from 'lodash'
import validate from 'validate.js'
import PasswordStrength from './common/password-strength.vue'

import registerMutation from 'gql/register/register-mutation-create.gql'

export default {
  i18nOptions: { namespaces: 'auth' },
  components: {
    PasswordStrength
  },
  data () {
    return {
      email: '',
      password: '',
      verifyPassword: '',
      name: '',
      hidePassword: true,
      isLoading: false,
      isShown: false,
      loaderColor: 'grey darken-4',
      loaderTitle: 'Working...',
      loaderSubtitle: 'Please wait',
      loaderMode: 'icon',
      loaderIcon: 'checkmark'
    }
  },
  computed: {
    siteTitle () {
      return siteConfig.title
    }
  },
  mounted () {
    this.isShown = true
    this.$nextTick(() => {
      this.$refs.iptEmail.focus()
    })
  },
  methods: {
    /**
     * REGISTER
     */
    async register () {
      const validation = validate({
        email: this.email,
        password: this.password,
        verifyPassword: this.verifyPassword,
        name: this.name
      }, {
        email: {
          presence: {
            message: this.$t('auth:missingEmail'),
            allowEmpty: false
          },
          email: {
            message: this.$t('auth:invalidEmail')
          }
        },
        password: {
          presence: {
            message: this.$t('auth:missingPassword'),
            allowEmpty: false
          },
          length: {
            minimum: 6,
            tooShort: this.$t('auth:passwordTooShort')
          }
        },
        verifyPassword: {
          equality: {
            attribute: 'password',
            message: this.$t('auth:passwordNotMatch')
          }
        },
        name: {
          presence: {
            message: this.$t('auth:missingName'),
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255,
            tooShort: this.$t('auth:nameTooShort'),
            tooLong: this.$t('auth:nameTooLong')
          }
        }
      }, { fullMessages: false })

      if (validation) {
        if (validation.email) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.email[0],
            icon: 'warning'
          })
          this.$refs.iptEmail.focus()
        } else if (validation.password) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.password[0],
            icon: 'warning'
          })
          this.$refs.iptPassword.focus()
        } else if (validation.verifyPassword) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.verifyPassword[0],
            icon: 'warning'
          })
          this.$refs.iptVerifyPassword.focus()
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.name[0],
            icon: 'warning'
          })
          this.$refs.iptName.focus()
        }
      } else {
        this.loaderColor = 'grey darken-4'
        this.loaderTitle = this.$t('auth:registering')
        this.loaderSubtitle = this.$t(`auth:pleaseWait`)
        this.loaderMode = 'loading'
        this.isLoading = true
        try {
          let resp = await this.$apollo.mutate({
            mutation: registerMutation,
            variables: {
              email: this.email,
              password: this.password,
              name: this.name
            }
          })
          if (_.has(resp, 'data.authentication.register')) {
            let respObj = _.get(resp, 'data.authentication.register', {})
            if (respObj.responseResult.succeeded === true) {
              this.loaderColor = 'grey darken-4'
              this.loaderTitle = this.$t('auth:registerSuccess')
              this.loaderSubtitle = this.$t(`auth:registerCheckEmail`)
              this.loaderMode = 'icon'
              this.isShown = false
            } else {
              throw new Error(respObj.responseResult.message)
            }
          } else {
            throw new Error(this.$t('auth:genericError'))
          }
        } catch (err) {
          console.error(err)
          this.$store.commit('showNotification', {
            style: 'red',
            message: err.message,
            icon: 'warning'
          })
          this.isLoading = false
        }
      }
    }
  }
}
</script>

<style lang="scss">
  .register {
    background-color: mc('indigo', '900');
    background-image: url('../static/svg/motif-blocks.svg');
    background-repeat: repeat;
    background-size: 200px;
    width: 100%;
    height: 100%;
    animation: loginBgReveal 20s linear infinite;

    @include keyframes(loginBgReveal) {
      0% {
        background-position-x: 0;
      }
      100% {
        background-position-x: 800px;
      }
    }

    &::before {
      content: '';
      position: absolute;
      background-image: url('../static/svg/motif-overlay.svg');
      background-attachment: fixed;
      background-size: cover;
      opacity: .5;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
    }

    > .container {
      height: 100%;
      align-items: center;
      display: flex;
    }

    .v-text-field.centered input {
      text-align: center;
    }
  }
</style>
