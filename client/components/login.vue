<template lang="pug">
  v-app.detran-login-app
    .detran-login
      //- Elementos decorativos de fundo (blobs luminosos com blur)
      .detran-login-blobs(aria-hidden='true')
        .detran-login-blob.detran-login-blob--top
        .detran-login-blob.detran-login-blob--mid
        .detran-login-blob.detran-login-blob--bottom

      //- Grid principal: Lado Institucional + Card de Login
      .detran-login-container
        .detran-login-layout

          //- -------------------------------------------------------------
          //- PAINEL ESQUERDO: Identidade Institucional Detran-MG
          //- -------------------------------------------------------------
          .detran-login-hero
            //- Logo / Branding
            .detran-login-brand
              img.detran-login-brand__img(
                src='/_assets/img/detran-logo-white.png'
                alt='Detran-MG'
              )
              span.detran-login-brand__badge Intranet Corporativa

            //- Mensagem de Boas-Vindas
            .detran-login-hero__body
              h2.detran-login-hero__headline Bem-vindo à Intranet Corporativa
              p.detran-login-hero__description
                | Plataforma oficial de gestão do conhecimento, manuais operacionais, procedimentos e sistemas do Departamento de Trânsito de Minas Gerais.

              //- Destaques em cards de vidro
              .detran-login-features
                .detran-login-feature
                  .detran-login-feature__icon
                    v-icon(size='20' color='#5fc381') mdi-shield-check
                  .detran-login-feature__content
                    h4.detran-login-feature__title Ambiente Seguro
                    p.detran-login-feature__desc Acesso restrito e auditável para servidores e colaboradores

                .detran-login-feature
                  .detran-login-feature__icon
                    v-icon(size='20' color='#5fc381') mdi-book-open-page-variant
                  .detran-login-feature__content
                    h4.detran-login-feature__title Base Centralizada
                    p.detran-login-feature__desc Procedimentos operacionais padrão e documentação técnica

                .detran-login-feature
                  .detran-login-feature__icon
                    v-icon(size='20' color='#5fc381') mdi-monitor-dashboard
                  .detran-login-feature__content
                    h4.detran-login-feature__title Serviços e Sistemas
                    p.detran-login-feature__desc Acesso unificado aos sistemas e rotinas institucionais

            //- Rodapé institucional
            .detran-login-hero__footer
              span.detran-login-hero__state Governo do Estado de Minas Gerais

          //- -------------------------------------------------------------
          //- PAINEL DIREITO: Card Glassmorphism de Autenticação
          //- -------------------------------------------------------------
          .detran-login-card-wrap
            .detran-login-card
              //- Cabeçalho do Card
              .detran-login-card__header
                .detran-login-card__badge
                  v-icon(size='14' color='#288b4a') mdi-lock-outline
                  span Acesso Restrito
                h3.detran-login-card__title {{ formScreenTitle }}
                p.detran-login-card__subtitle {{ formScreenSubtitle }}

              //- Mensagem de Erro
              v-alert.detran-login-alert(
                v-model='errorShown'
                transition='slide-y-transition'
                color='red darken-2'
                dense
                outlined
                icon='mdi-alert-circle'
              )
                span.detran-login-alert__text {{ errorMessage }}

              //- ---------------------------------------------------------
              //- 1. PROVEDORES EXTERNOS / SSO (Google, Azure AD, SAML, etc.)
              //- ---------------------------------------------------------
              template(v-if='screen === `login` && ssoStrategies.length > 0')
                .detran-login-sso
                  p.detran-login-sso__title Métodos de acesso configurados:
                  .detran-login-sso__list
                    button.detran-btn-sso(
                      v-for='stg of ssoStrategies'
                      :key='stg.key'
                      type='button'
                      :disabled='isLoading'
                      @click='loginWithSSO(stg)'
                    )
                      .detran-btn-sso__icon(v-html='stg.strategy.icon')
                      span.detran-btn-sso__text Entrar com {{ stg.displayName }}
                      v-icon(size='16' color='#64748b') mdi-chevron-right

              //- Divisor institucional se houver SSO e também Form
              .detran-login-divider(v-if='screen === `login` && ssoStrategies.length > 0 && formStrategies.length > 0')
                span ou acesse com credenciais

              //- ---------------------------------------------------------
              //- 2. PROVEDORES BASEADOS EM FORMULÁRIO (Local, LDAP, etc.)
              //- ---------------------------------------------------------
              template(v-if='screen === `login` && formStrategies.length > 0')
                //- Seletor de abas se houver mais de 1 provedor com formulário
                .detran-method-tabs.mb-4(v-if='formStrategies.length > 1')
                  button.detran-method-tab(
                    v-for='stg of formStrategies'
                    :key='stg.key'
                    type='button'
                    :class='{ "is-active": selectedStrategyKey === stg.key }'
                    @click='selectStrategy(stg.key)'
                  )
                    .detran-method-tab__icon(v-html='stg.strategy.icon')
                    span {{ stg.displayName }}

                //- Indicador do método se houver apenas 1 formulário
                .detran-method-indicator.mb-4(v-else-if='filteredStrategies.length === 1 || ssoStrategies.length > 0')
                  .detran-method-indicator__badge
                    .detran-method-indicator__icon(v-html='selectedStrategy.strategy.icon')
                    span Autenticação via {{ selectedStrategy.displayName }}

                //- Formulário de Login
                form.detran-login-form(@submit.prevent='login')
                  //- Campo Usuário/Email
                  .detran-field
                    label.detran-field__label(for='login-username')
                      | {{ isUsernameEmail ? $t('auth:fields.email', 'E-mail Institucional') : $t('auth:fields.username', 'Usuário / Identificação') }}
                    .detran-field__control
                      v-text-field.detran-text-field(
                        id='login-username'
                        solo
                        flat
                        prepend-inner-icon='mdi-account-outline'
                        hide-details
                        ref='iptEmail'
                        v-model='username'
                        :placeholder='isUsernameEmail ? "seu.email@detran.mg.gov.br" : "Digite seu usuário"'
                        :type='isUsernameEmail ? "email" : "text"'
                        :autocomplete='isUsernameEmail ? "email" : "username"'
                        light
                      )

                  //- Campo Senha
                  .detran-field.mt-4
                    .detran-field__label-row
                      label.detran-field__label(for='login-password') {{ $t('auth:fields.password', 'Senha') }}
                      a.detran-field__forgot-link(
                        v-if='selectedStrategyKey === `local`'
                        href='#forgot'
                        @click.stop.prevent='forgotPassword'
                      ) {{ $t('auth:forgotPasswordLink', 'Esqueci minha senha') }}
                    .detran-field__control
                      v-text-field.detran-text-field(
                        id='login-password'
                        solo
                        flat
                        prepend-inner-icon='mdi-lock-outline'
                        hide-details
                        ref='iptPassword'
                        v-model='password'
                        :append-icon='hidePassword ? "mdi-eye-off-outline" : "mdi-eye-outline"'
                        @click:append='() => (hidePassword = !hidePassword)'
                        :type='hidePassword ? "password" : "text"'
                        :placeholder='$t("auth:fields.password", "Digite sua senha")'
                        autocomplete='current-password'
                        @keyup.enter='login'
                        light
                      )

                  //- Botão de Entrar
                  button.detran-btn-primary.mt-6(
                    type='submit'
                    :disabled='isLoading'
                    :class='{ "is-loading": isLoading }'
                  )
                    v-icon.mr-2(v-if='!isLoading' size='18' color='white') mdi-login
                    v-progress-circular.mr-2(v-else indeterminate size='18' color='white' width='2')
                    span {{ isLoading ? $t('auth:signingIn', 'Autenticando...') : $t('auth:actions.login', 'Entrar no Sistema') }}

                  //- Link para Registro (se ativado)
                  .detran-login-card__extra.mt-4(v-if='selectedStrategyKey === `local` && selectedStrategy.selfRegistration')
                    span.detran-login-card__extra-text Não possui acesso?&nbsp;
                    a.detran-login-card__extra-link(href='/register') {{ $t('auth:switchToRegister.link', 'Criar cadastro') }}

              //- ---------------------------------------------------------
              //- 3. APENAS SSO CONFIGURADO (Sem formulário)
              //- ---------------------------------------------------------
              template(v-else-if='screen === `login` && formStrategies.length === 0 && ssoStrategies.length > 0')
                .detran-login-sso-only.text-center.py-3
                  p.detran-login-sso-only__desc
                    | O acesso a este portal está restrito aos provedores de autenticação única configurados acima.

              //- ---------------------------------------------------------
              //- 4. NENHUMA ESTRATÉGIA ATIVA
              //- ---------------------------------------------------------
              template(v-else-if='screen === `login` && filteredStrategies.length === 0')
                .detran-login-none.text-center.py-6
                  v-icon(size='40' color='#94a3b8') mdi-shield-alert-outline
                  p.mt-3.grey--text Nenhuma estratégia de autenticação ativa no momento.
                  p.caption.grey--text Configure os métodos de acesso na aba de Administração.

              //- ---------------------------------------------------------
              //- FORMULÁRIO DE ESQUECI A SENHA
              //- ---------------------------------------------------------
              template(v-if='screen === `forgot`')
                form.detran-login-form(@submit.prevent='forgotPasswordSubmit')
                  .detran-field
                    label.detran-field__label(for='forgot-email') {{ $t('auth:fields.email', 'E-mail Cadastrado') }}
                    .detran-field__control
                      v-text-field.detran-text-field(
                        id='forgot-email'
                        solo
                        flat
                        prepend-inner-icon='mdi-email-outline'
                        hide-details
                        ref='iptForgotPwdEmail'
                        v-model='username'
                        placeholder='seu.email@detran.mg.gov.br'
                        type='email'
                        autocomplete='email'
                        light
                      )

                  button.detran-btn-primary.mt-6(
                    type='submit'
                    :disabled='isLoading'
                  )
                    v-icon.mr-2(v-if='!isLoading' size='18' color='white') mdi-email-send-outline
                    v-progress-circular.mr-2(v-else indeterminate size='18' color='white' width='2')
                    span {{ isLoading ? 'Enviando...' : $t('auth:sendResetPassword', 'Enviar Instruções') }}

                  button.detran-btn-secondary.mt-3(
                    type='button'
                    @click.stop.prevent='screen = `login`'
                  )
                    v-icon.mr-2(size='16' color='#475569') mdi-arrow-left
                    span {{ $t('auth:forgotPasswordCancel', 'Voltar ao Login') }}

              //- ---------------------------------------------------------
              //- FORMULÁRIO DE ALTERAÇÃO DE SENHA
              //- ---------------------------------------------------------
              template(v-if='screen === `changePwd`')
                form.detran-login-form(@submit.prevent='changePassword')
                  .detran-field
                    label.detran-field__label Nova Senha
                    .detran-field__control
                      v-text-field.detran-text-field(
                        type='password'
                        solo
                        flat
                        prepend-inner-icon='mdi-lock-outline'
                        hide-details
                        ref='iptNewPassword'
                        v-model='newPassword'
                        :placeholder='$t("auth:changePwd.newPasswordPlaceholder", "Digite a nova senha")'
                        autocomplete='new-password'
                        light
                      )
                        password-strength(slot='progress' v-model='newPassword')

                  .detran-field.mt-4
                    label.detran-field__label Confirmar Nova Senha
                    .detran-field__control
                      v-text-field.detran-text-field(
                        type='password'
                        solo
                        flat
                        prepend-inner-icon='mdi-lock-check-outline'
                        hide-details
                        v-model='newPasswordVerify'
                        :placeholder='$t("auth:changePwd.newPasswordVerifyPlaceholder", "Confirme a nova senha")'
                        autocomplete='new-password'
                        @keyup.enter='changePassword'
                        light
                      )

                  button.detran-btn-primary.mt-6(
                    type='submit'
                    :disabled='isLoading'
                  )
                    span {{ $t('auth:changePwd.proceed', 'Atualizar Senha') }}

              //- Rodapé de Segurança do Card
              .detran-login-security.mt-6
                v-icon(size='14' color='#94a3b8') mdi-shield-lock-outline
                span Comunicação segura com certificado digital SSL/TLS

      //- -------------------------------------------------------------
      //- MODAIS TFA (Preservados integralmente)
      //- -------------------------------------------------------------
      v-dialog(v-model='isTFAShown' max-width='460' persistent content-class='detran-tfa-dialog')
        v-card.detran-tfa-card
          .detran-tfa-card__inner.text-center.pa-6
            .detran-tfa-card__icon
              v-icon(size='32' color='#33a65b') mdi-shield-key-outline
            h3.detran-tfa-card__title {{$t('auth:tfaFormTitle', 'Autenticação em Duas Etapas')}}
            p.detran-tfa-card__desc Informe o código gerado pelo aplicativo autenticador
            v-text-field.detran-text-field.detran-text-field--center.mt-4(
              solo
              flat
              hide-details
              ref='iptTFA'
              v-model='securityCode'
              :placeholder='$t("auth:tfa.placeholder", "000000")'
              autocomplete='one-time-code'
              @keyup.enter='verifySecurityCode(false)'
              light
            )
            button.detran-btn-primary.mt-4(
              type='button'
              @click='verifySecurityCode(false)'
              :disabled='isLoading'
            )
              span {{$t('auth:tfa.verifyToken', 'Confirmar Código')}}

      v-dialog(v-model='isTFASetupShown' max-width='520' persistent content-class='detran-tfa-dialog')
        v-card.detran-tfa-card
          .detran-tfa-card__inner.pa-6
            h3.detran-tfa-card__title.text-center {{$t('auth:tfaSetupTitle', 'Configuração de Duas Etapas')}}
            v-divider.my-4
            p.detran-tfa-card__desc {{$t('auth:tfaSetupInstrFirst')}}
            .detran-tfa-qr.my-4.text-center(v-if='isTFASetupShown' v-html='tfaQRImage')
            p.detran-tfa-card__desc {{$t('auth:tfaSetupInstrSecond')}}
            v-text-field.detran-text-field.detran-text-field--center.mt-4(
              solo
              flat
              hide-details
              ref='iptTFASetup'
              v-model='securityCode'
              :placeholder='$t("auth:tfa.placeholder", "000000")'
              autocomplete='one-time-code'
              @keyup.enter='verifySecurityCode(true)'
              light
            )
            button.detran-btn-primary.mt-4(
              type='button'
              @click='verifySecurityCode(true)'
              :disabled='isLoading'
            )
              span {{$t('auth:tfa.verifyToken', 'Ativar e Confirmar')}}

      loader(v-model='isLoading' :color='loaderColor' :title='loaderTitle' :subtitle='$t("auth:pleaseWait")')
      notify(style='padding-top: 64px;')
</template>

<script>
/* global siteConfig */

// <span>Photo by <a href="https://unsplash.com/@isaacquesada?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Isaac Quesada</a> on <a href="/t/textures-patterns?utm_source=unsplash&amp;utm_medium=referral&amp;utm_content=creditCopyText">Unsplash</a></span>

import _ from 'lodash'
import Cookies from 'js-cookie'
import gql from 'graphql-tag'
import { sync } from 'vuex-pathify'

export default {
  i18nOptions: { namespaces: 'auth' },
  props: {
    bgUrl: {
      type: String,
      default: ''
    },
    hideLocal: {
      type: Boolean,
      default: false
    },
    changePwdContinuationToken: {
      type: String,
      default: null
    }
  },
  data () {
    return {
      error: false,
      strategies: [],
      selectedStrategyKey: 'local',
      screen: 'login',
      username: '',
      password: '',
      hidePassword: true,
      securityCode: '',
      continuationToken: '',
      isLoading: false,
      loaderColor: 'grey darken-4',
      loaderTitle: 'Working...',
      isShown: false,
      newPassword: '',
      newPasswordVerify: '',
      isTFAShown: false,
      isTFASetupShown: false,
      tfaQRImage: '',
      errorShown: false,
      errorMessage: ''
    }
  },
  computed: {
    activeModal: sync('editor/activeModal'),
    siteTitle () {
      return siteConfig.title
    },
    isSocialShown () {
      return this.strategies.length > 1
    },
    logoUrl () { return siteConfig.logoUrl },
    filteredStrategies () {
      const qParams = new URLSearchParams(window.location.search)
      if (this.hideLocal && !qParams.has('all')) {
        return _.reject(this.strategies, ['key', 'local'])
      } else {
        return this.strategies
      }
    },
    formStrategies () {
      return this.filteredStrategies.filter(s => s.strategy && s.strategy.useForm)
    },
    ssoStrategies () {
      return this.filteredStrategies.filter(s => s.strategy && !s.strategy.useForm)
    },
    selectedStrategy () {
      let stg = _.find(this.strategies, ['key', this.selectedStrategyKey])
      if (!stg && this.formStrategies.length > 0) {
        stg = this.formStrategies[0]
      }
      if (!stg && this.filteredStrategies.length > 0) {
        stg = this.filteredStrategies[0]
      }
      return stg || { key: 'local', strategy: { useForm: true, usernameType: 'email', icon: '', color: 'blue darken-2' }, displayName: 'Local' }
    },
    isUsernameEmail () {
      return _.get(this.selectedStrategy, 'strategy.usernameType', 'email') === 'email'
    },
    formScreenTitle () {
      if (this.screen === 'forgot') return 'Recuperação de Senha'
      if (this.screen === 'changePwd') return 'Alteração de Senha'
      return 'Identificação'
    },
    formScreenSubtitle () {
      if (this.screen === 'forgot') return 'Informe seu e-mail para receber as instruções'
      if (this.screen === 'changePwd') return 'Defina uma nova senha para sua conta'
      if (this.ssoStrategies.length > 0 && this.formStrategies.length > 0) {
        return 'Selecione a forma de acesso institucional ou informe suas credenciais'
      }
      if (this.ssoStrategies.length > 0 && this.formStrategies.length === 0) {
        return 'Selecione seu provedor de acesso institucional para entrar'
      }
      return 'Informe suas credenciais institucionais para continuar'
    }
  },
  watch: {
    filteredStrategies: {
      immediate: true,
      handler (newValue) {
        if (!newValue || newValue.length === 0) return
        if (!_.some(newValue, ['key', this.selectedStrategyKey])) {
          const firstForm = _.find(newValue, s => s.strategy && s.strategy.useForm)
          if (firstForm) {
            this.selectedStrategyKey = firstForm.key
          } else {
            this.selectedStrategyKey = _.head(newValue).key
          }
        }
      }
    },
    selectedStrategyKey () {
      if (this.screen === 'changePwd') {
        return
      }
      this.screen = 'login'
      this.$nextTick(() => {
        if (this.$refs.iptEmail) {
          this.$refs.iptEmail.focus()
        }
      })
    }
  },
  mounted () {
    this.isShown = true
    if (this.changePwdContinuationToken) {
      this.screen = 'changePwd'
      this.continuationToken = this.changePwdContinuationToken
    }
  },
  methods: {
    loginWithSSO (stg) {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = `Redirecionando para ${stg.displayName}...`
      this.isLoading = true
      window.location.assign('/login/' + stg.key)
    },
    selectStrategy (key) {
      this.selectedStrategyKey = key
      this.$nextTick(() => {
        if (this.$refs.iptEmail) {
          this.$refs.iptEmail.focus()
        }
      })
    },
    /**
     * LOGIN
     */
    async login () {
      this.errorShown = false
      if (this.username.length < 2) {
        this.errorMessage = this.$t('auth:invalidEmailUsername')
        this.errorShown = true
        this.$refs.iptEmail.focus()
      } else if (this.password.length < 2) {
        this.errorMessage = this.$t('auth:invalidPassword')
        this.errorShown = true
        this.$refs.iptPassword.focus()
      } else {
        this.loaderColor = 'grey darken-4'
        this.loaderTitle = this.$t('auth:signingIn')
        this.isLoading = true
        try {
          const resp = await this.$apollo.mutate({
            mutation: gql`
              mutation($username: String!, $password: String!, $strategy: String!) {
                authentication {
                  login(username: $username, password: $password, strategy: $strategy) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    jwt
                    mustChangePwd
                    mustProvideTFA
                    mustSetupTFA
                    continuationToken
                    redirect
                    tfaQRImage
                  }
                }
              }
            `,
            variables: {
              username: this.username,
              password: this.password,
              strategy: this.selectedStrategy.key
            }
          })
          if (_.has(resp, 'data.authentication.login')) {
            const respObj = _.get(resp, 'data.authentication.login', {})
            if (respObj.responseResult.succeeded === true) {
              this.handleLoginResponse(respObj)
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
            icon: 'alert'
          })
          this.isLoading = false
        }
      }
    },
    /**
     * VERIFY TFA CODE
     */
    async verifySecurityCode (setup = false) {
      if (this.securityCode.length !== 6) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Enter a valid security code.',
          icon: 'alert'
        })
        if (setup) {
          this.$refs.iptTFASetup.focus()
        } else {
          this.$refs.iptTFA.focus()
        }
      } else {
        this.loaderColor = 'grey darken-4'
        this.loaderTitle = this.$t('auth:signingIn')
        this.isLoading = true
        try {
          const resp = await this.$apollo.mutate({
            mutation: gql`
              mutation(
                $continuationToken: String!
                $securityCode: String!
                $setup: Boolean
                ) {
                authentication {
                  loginTFA(
                    continuationToken: $continuationToken
                    securityCode: $securityCode
                    setup: $setup
                    ) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    jwt
                    mustChangePwd
                    continuationToken
                    redirect
                  }
                }
              }
            `,
            variables: {
              continuationToken: this.continuationToken,
              securityCode: this.securityCode,
              setup
            }
          })
          if (_.has(resp, 'data.authentication.loginTFA')) {
            let respObj = _.get(resp, 'data.authentication.loginTFA', {})
            if (respObj.responseResult.succeeded === true) {
              this.handleLoginResponse(respObj)
            } else {
              if (!setup) {
                this.isTFAShown = false
              }
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
            icon: 'alert'
          })
          this.isLoading = false
        }
      }
    },
    /**
     * CHANGE PASSWORD
     */
    async changePassword () {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = this.$t('auth:changePwd.loading')
      this.isLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $continuationToken: String!
              $newPassword: String!
            ) {
              authentication {
                loginChangePassword (
                  continuationToken: $continuationToken
                  newPassword: $newPassword
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  jwt
                  continuationToken
                  redirect
                }
              }
            }
          `,
          variables: {
            continuationToken: this.continuationToken,
            newPassword: this.newPassword
          }
        })
        if (_.has(resp, 'data.authentication.loginChangePassword')) {
          let respObj = _.get(resp, 'data.authentication.loginChangePassword', {})
          if (respObj.responseResult.succeeded === true) {
            this.handleLoginResponse(respObj)
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
          icon: 'alert'
        })
        this.isLoading = false
      }
    },
    /**
     * SWITCH TO FORGOT PASSWORD SCREEN
     */
    forgotPassword () {
      this.screen = 'forgot'
      this.$nextTick(() => {
        this.$refs.iptForgotPwdEmail.focus()
      })
    },
    /**
     * FORGOT PASSWORD SUBMIT
     */
    async forgotPasswordSubmit () {
      this.loaderColor = 'grey darken-4'
      this.loaderTitle = this.$t('auth:forgotPasswordLoading')
      this.isLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $email: String!
            ) {
              authentication {
                forgotPassword (
                  email: $email
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            email: this.username
          }
        })
        if (_.has(resp, 'data.authentication.forgotPassword.responseResult')) {
          let respObj = _.get(resp, 'data.authentication.forgotPassword.responseResult', {})
          if (respObj.succeeded === true) {
            this.$store.commit('showNotification', {
              style: 'success',
              message: this.$t('auth:forgotPasswordSuccess'),
              icon: 'email'
            })
            this.screen = 'login'
          } else {
            throw new Error(respObj.message)
          }
        } else {
          throw new Error(this.$t('auth:genericError'))
        }
      } catch (err) {
        console.error(err)
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.isLoading = false
    },
    handleLoginResponse (respObj) {
      this.continuationToken = respObj.continuationToken
      if (respObj.mustChangePwd === true) {
        this.screen = 'changePwd'
        this.$nextTick(() => {
          this.$refs.iptNewPassword.focus()
        })
        this.isLoading = false
      } else if (respObj.mustProvideTFA === true) {
        this.securityCode = ''
        this.isTFAShown = true
        setTimeout(() => {
          this.$refs.iptTFA.focus()
        }, 500)
        this.isLoading = false
      } else if (respObj.mustSetupTFA === true) {
        this.securityCode = ''
        this.isTFASetupShown = true
        this.tfaQRImage = respObj.tfaQRImage
        setTimeout(() => {
          this.$refs.iptTFASetup.focus()
        }, 500)
        this.isLoading = false
      } else {
        this.loaderColor = 'green darken-1'
        this.loaderTitle = this.$t('auth:loginSuccess')
        Cookies.set('jwt', respObj.jwt, { expires: 365, secure: window.location.protocol === 'https:' })
        _.delay(() => {
          // -> Prioridade para retorno a aplicação satélite (?returnApp=)
          const rawReturnAppId = Cookies.get('returnApp')
          if (rawReturnAppId && /^[a-z0-9_-]+$/i.test(rawReturnAppId.trim())) {
            const returnAppId = encodeURIComponent(rawReturnAppId.trim().toLowerCase())
            Cookies.remove('returnApp')
            window.location.replace(`/apps/${returnAppId}`)
            return
          } else if (rawReturnAppId) {
            Cookies.remove('returnApp')
          }

          const loginRedirect = Cookies.get('loginRedirect')
          const isValidRedirect = loginRedirect && loginRedirect.startsWith('/') && !loginRedirect.startsWith('//') && !loginRedirect.includes('://')
          if (loginRedirect === '/' && respObj.redirect) {
            Cookies.remove('loginRedirect')
            window.location.replace(respObj.redirect)
          } else if (isValidRedirect) {
            Cookies.remove('loginRedirect')
            window.location.replace(loginRedirect)
          } else {
            if (loginRedirect) {
              Cookies.remove('loginRedirect')
            }
            if (respObj.redirect) {
              window.location.replace(respObj.redirect)
            } else {
              window.location.replace('/')
            }
          }
        }, 1000)
      }
    }
  },
  apollo: {
    strategies: {
      query: gql`
        {
          authentication {
            activeStrategies(enabledOnly: true) {
              key
              strategy {
                key
                logo
                color
                icon
                useForm
                usernameType
              }
              displayName
              order
              selfRegistration
            }
          }
        }
      `,
      update: (data) => _.sortBy(data.authentication.activeStrategies, ['order']),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'login-strategies-refresh')
      }
    }
  }
}
</script>

<style lang="scss">
@import '../themes/detran/scss/variables';

// =============================================================================
// DETRAN-MG DESIGN SYSTEM — PÁGINA DE LOGIN
// Fundo institucional degradê + orbes luminosos + card glassmorphism refinado
// =============================================================================

.detran-login-app {
  font-family: $font-family-base !important;
  background: transparent !important;
}

.detran-login {
  min-height: 100vh;
  width: 100%;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at 25% 20%, #1f6437 0%, #164828 40%, #0e301a 80%, #092011 100%) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
}

// -----------------------------------------------------------------------------
// Blobs Luminosos Orgânicos (Fundo)
// -----------------------------------------------------------------------------
.detran-login-blobs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1;

  .detran-login-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    opacity: 0.45;
    will-change: transform;

    &--top {
      width: 480px;
      height: 480px;
      top: -120px;
      right: -80px;
      background: radial-gradient(circle, #33a65b 0%, rgba(51, 166, 91, 0) 70%);
      animation: detranLivingOrb1 16s ease-in-out infinite alternate;
    }

    &--mid {
      width: 520px;
      height: 520px;
      bottom: -150px;
      left: 10%;
      background: radial-gradient(circle, #288b4a 0%, rgba(40, 139, 74, 0) 70%);
      animation: detranLivingOrb2 22s ease-in-out infinite alternate-reverse;
    }

    &--bottom {
      width: 400px;
      height: 400px;
      top: 35%;
      right: 20%;
      background: radial-gradient(circle, #5fc381 0%, rgba(95, 195, 129, 0) 70%);
      opacity: 0.35;
      animation: detranLivingOrb3 18s ease-in-out infinite alternate;
    }
  }
}

// -----------------------------------------------------------------------------
// Container & Layout Principal
// -----------------------------------------------------------------------------
.detran-login-container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
}

.detran-login-layout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 3.5rem;

  @media (max-width: 959px) {
    flex-direction: column;
    gap: 2rem;
  }
}

// -----------------------------------------------------------------------------
// Painel Esquerdo: Identidade Institucional Detran-MG
// -----------------------------------------------------------------------------
.detran-login-hero {
  flex: 1.1;
  color: white;

  @media (max-width: 959px) {
    text-align: center;
  }
}

.detran-login-brand {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 2rem;

  @media (max-width: 959px) {
    justify-content: center;
    flex-wrap: wrap;
  }

  &__img {
    max-height: 50px;
    max-width: 240px;
    width: auto;
    height: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.25));
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    padding: 0.35rem 0.85rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #e2f5e8;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 9999px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.detran-login-hero__headline {
  font-size: 2.25rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: #ffffff;
  margin-bottom: 1rem;

  @media (max-width: 959px) {
    font-size: 1.75rem;
  }
}

.detran-login-hero__description {
  font-size: 1rem;
  line-height: 1.6;
  color: #d1fae5;
  opacity: 0.9;
  margin-bottom: 2.25rem;
  max-width: 480px;

  @media (max-width: 959px) {
    margin-left: auto;
    margin-right: auto;
  }
}

// Cards de Destaques
.detran-login-features {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;

  @media (max-width: 959px) {
    display: none;
  }
}

.detran-login-feature {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.125rem;
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: $radius-lg;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(255, 255, 255, 0.14);
    transform: translateX(4px);
    border-color: rgba(255, 255, 255, 0.25);
  }

  &__icon {
    width: 38px;
    height: 38px;
    background: rgba(255, 255, 255, 0.9);
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  }

  &__content {
    display: flex;
    flex-direction: column;
  }

  &__title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
  }

  &__desc {
    font-size: 0.75rem;
    color: #cce0d2;
    margin: 2px 0 0 0;
  }
}

.detran-login-hero__footer {
  font-size: 0.8125rem;
  color: #94dbab;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;

  @media (max-width: 959px) {
    justify-content: center;
  }
}

// -----------------------------------------------------------------------------
// Painel Direito: Card Glassmorphism
// -----------------------------------------------------------------------------
.detran-login-card-wrap {
  flex: 0.9;
  width: 100%;
  max-width: 450px;

  @media (max-width: 959px) {
    max-width: 420px;
    margin: 0 auto;
  }
}

.detran-login-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.3);
  padding: 2.25rem 2rem;
  color: $slate-800;
  animation: detranCardLivingGlow 9s ease-in-out infinite;

  &__header {
    margin-bottom: 1.75rem;
  }

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: $detran-50;
    color: $detran-700;
    padding: 0.25rem 0.625rem;
    border-radius: $radius-full;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
    border: 1px solid $detran-200;
  }

  &__title {
    font-size: 1.5rem;
    font-weight: 800;
    color: $slate-900;
    letter-spacing: -0.02em;
    margin: 0;
  }

  &__subtitle {
    font-size: 0.875rem;
    color: $slate-500;
    margin: 0.375rem 0 0 0;
    line-height: 1.4;
  }
}

// Alert de Erro
.detran-login-alert {
  border-radius: 10px !important;
  background: #fef2f2 !important;
  border: 1px solid #fecaca !important;
  color: #b91c1c !important;
  margin-bottom: 1.25rem !important;
  padding: 0.75rem 1rem !important;

  .v-icon {
    color: #dc2626 !important;
    font-size: 20px !important;
  }

  &__text {
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.4;
    color: #b91c1c;
  }
}

// Provedores de Autenticação SSO / Externos
.detran-login-sso {
  margin-bottom: 1.25rem;

  &__title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $slate-500;
    margin-bottom: 0.625rem;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}

.detran-btn-sso {
  width: 100%;
  display: flex;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

  &:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #33a65b;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(51, 166, 91, 0.12);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &__icon {
    width: 22px;
    height: 22px;
    margin-right: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 22px !important;
      height: 22px !important;
      max-width: 22px !important;
      max-height: 22px !important;
      display: block;
    }
  }

  &__text {
    flex: 1;
    text-align: left;
  }
}

// Divisor entre SSO e Formulário
.detran-login-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 1.25rem 0;
  color: #94a3b8;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;

  &::before, &::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #e2e8f0;
  }

  &::before {
    margin-right: 0.75rem;
  }

  &::after {
    margin-left: 0.75rem;
  }
}

// Abas de Métodos com Formulário
.detran-method-tabs {
  display: flex;
  gap: 0.375rem;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.detran-method-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s ease;

  &.is-active {
    background: #ffffff;
    color: #092011;
    font-weight: 600;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }

  &__icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 18px !important;
      height: 18px !important;
      max-width: 18px !important;
      max-height: 18px !important;
      display: block;
    }
  }
}

// Indicador de Método Ativo (Único Formulário)
.detran-method-indicator {
  display: flex;
  align-items: center;

  &__badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    background: rgba(51, 166, 91, 0.08);
    border: 1px solid rgba(51, 166, 91, 0.2);
    color: #166534;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  &__icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 16px !important;
      height: 16px !important;
      max-width: 16px !important;
      max-height: 16px !important;
      display: block;
    }
  }
}

.detran-login-sso-only {
  &__desc {
    font-size: 0.8125rem;
    color: $slate-500;
    line-height: 1.5;
    margin: 0;
  }
}

// Campos do Formulário
.detran-field {
  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: $slate-600;
    margin-bottom: 0.375rem;
  }

  &__label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.375rem;
  }

  &__forgot-link {
    font-size: 0.75rem;
    font-weight: 600;
    color: $detran-600;
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: $detran-800;
      text-decoration: underline;
    }
  }
}

// Override dos Text Fields do Vuetify
.detran-text-field {
  margin: 0 !important;

  .v-input__slot {
    background: #f8fafc !important;
    border: 1.5px solid #e2e8f0 !important;
    border-radius: 10px !important;
    min-height: 48px !important;
    padding: 0 14px !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: none !important;

    &:hover {
      border-color: #cbd5e1 !important;
      background: #ffffff !important;
    }
  }

  &.v-input--is-focused .v-input__slot {
    border-color: #33a65b !important;
    background: #ffffff !important;
    box-shadow: 0 0 0 3.5px rgba(51, 166, 91, 0.2) !important;
  }

  input {
    color: #1e293b !important;
    font-size: 0.9375rem !important;
    font-weight: 500 !important;
    font-family: 'Inter', sans-serif !important;

    &::placeholder {
      color: #94a3b8 !important;
      font-weight: 400 !important;
    }
  }

  .v-icon {
    color: #94a3b8 !important;
    font-size: 20px !important;
    transition: color 0.2s ease;
  }

  &.v-input--is-focused .v-icon {
    color: #33a65b !important;
  }

  &--center input {
    text-align: center;
    font-size: 1.5rem !important;
    letter-spacing: 0.3em;
    font-weight: 700 !important;
  }
}

// Botão Primário (Verde Detran)
.detran-btn-primary {
  width: 100%;
  height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #33a65b 0%, #288b4a 100%);
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(51, 166, 91, 0.4);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover:not(:disabled) {
    background: linear-gradient(135deg, #3ab966 0%, #33a65b 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(51, 166, 91, 0.45);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 2px 8px rgba(51, 166, 91, 0.3);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
}

// Botão Secundário
.detran-btn-secondary {
  width: 100%;
  height: 44px;
  border-radius: 10px;
  background: #f1f5f9;
  color: #475569;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: 'Inter', sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
}

// Links e Extras
.detran-login-card__extra {
  text-align: center;
  font-size: 0.8125rem;

  &-text {
    color: $slate-500;
  }

  &-link {
    color: $detran-600;
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

// Rodapé de Segurança
.detran-login-security {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.6875rem;
  color: $slate-400;
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}

// Modais TFA
.detran-tfa-dialog {
  border-radius: 20px !important;
  overflow: hidden;
}

.detran-tfa-card {
  border-radius: 20px !important;
  background: #ffffff !important;

  &__icon {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: $detran-50;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  &__title {
    font-size: 1.25rem;
    font-weight: 800;
    color: $slate-900;
    margin: 0;
  }

  &__desc {
    font-size: 0.875rem;
    color: $slate-500;
    margin-top: 0.25rem;
  }
}

.detran-tfa-qr {
  display: flex;
  justify-content: center;

  svg, img {
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    padding: 8px;
  }
}
</style>
