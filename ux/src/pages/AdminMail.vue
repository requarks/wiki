<template lang='pug'>
q-page.admin-mail
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-message-settings.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.mail.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.mail.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/mail'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='mdi-check'
        :label='$t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-7
      //- -----------------------
      //- Configuration
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{$t('admin.mail.configuration')}}
        q-item
          blueprint-icon(icon='contact')
          q-item-section
            q-item-label {{$t(`admin.mail.senderName`)}}
            q-item-label(caption) {{$t(`admin.general.senderNameHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='config.senderName'
              dense
              hide-bottom-space
              :aria-label='$t(`admin.mail.senderName`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='envelope')
          q-item-section
            q-item-label {{$t(`admin.mail.senderEmail`)}}
            q-item-label(caption) {{$t(`admin.general.senderEmailHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='config.senderEmail'
              dense
              :aria-label='$t(`admin.mail.senderEmail`)'
              )
      //- -----------------------
      //- SMTP
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{$t('admin.mail.smtp')}}
        q-item
          blueprint-icon(icon='dns')
          q-item-section
            q-item-label {{$t(`admin.mail.smtpHost`)}}
            q-item-label(caption) {{$t(`admin.mail.smtpHostHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='config.host'
              dense
              hide-bottom-space
              :aria-label='$t(`admin.mail.smtpHost`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='ethernet-off')
          q-item-section
            q-item-label {{$t(`admin.mail.smtpPort`)}}
            q-item-label(caption) {{$t(`admin.mail.smtpPortHint`)}}
          q-item-section(style='flex: 0 0 120px;')
            q-input(
              outlined
              v-model='config.port'
              dense
              :aria-label='$t(`admin.mail.smtpPort`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='secure')
          q-item-section
            q-item-label {{$t(`admin.mail.smtpTLS`)}}
            q-item-label(caption) {{$t(`admin.mail.smtpTLSHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.secure'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.mail.smtpTLS`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='security-ssl')
          q-item-section
            q-item-label {{$t(`admin.mail.smtpVerifySSL`)}}
            q-item-label(caption) {{$t(`admin.mail.smtpVerifySSLHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.verifySSL'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.mail.smtpVerifySSL`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='test-account')
          q-item-section
            q-item-label {{$t(`admin.mail.smtpUser`)}}
            q-item-label(caption) {{$t(`admin.mail.smtpUserHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='config.user'
              dense
              :aria-label='$t(`admin.mail.smtpUser`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='password')
          q-item-section
            q-item-label {{$t(`admin.mail.smtpPwd`)}}
            q-item-label(caption) {{$t(`admin.mail.smtpPwdHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='config.pass'
              dense
              :aria-label='$t(`admin.mail.smtpPwd`)'
              )
      //- -----------------------
      //- DKIM
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{$t('admin.mail.dkim')}}
        q-item.q-pt-none
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section.text-caption {{ $t('admin.mail.dkimHint') }}
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='received')
          q-item-section
            q-item-label {{$t(`admin.mail.dkimUse`)}}
            q-item-label(caption) {{$t(`admin.mail.dkimUseHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.useDKIM'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.mail.dkimUse`)'
              )
        template(v-if='config.useDKIM')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='dns')
            q-item-section
              q-item-label {{$t(`admin.mail.dkimDomainName`)}}
              q-item-label(caption) {{$t(`admin.mail.dkimDomainNameHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='config.dkimDomainName'
                dense
                :aria-label='$t(`admin.mail.dkimDomainName`)'
                )
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='access')
            q-item-section
              q-item-label {{$t(`admin.mail.dkimKeySelector`)}}
              q-item-label(caption) {{$t(`admin.mail.dkimKeySelectorHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='config.dkimKeySelector'
                dense
                :aria-label='$t(`admin.mail.dkimKeySelector`)'
                )
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='grand-master-key')
            q-item-section
              q-item-label {{$t(`admin.mail.dkimPrivateKey`)}}
              q-item-label(caption) {{$t(`admin.mail.dkimPrivateKeyHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='config.dkimPrivateKey'
                dense
                :aria-label='$t(`admin.mail.dkimPrivateKey`)'
                type='textarea'
                )

    .col-12.col-lg-5
      //- -----------------------
      //- MAIL TEMPLATES
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{$t('admin.mail.templates')}}
        q-list
          q-item
            blueprint-icon(icon='resume-template')
            q-item-section
              q-item-label {{$t(`admin.mail.templateWelcome`)}}
            q-item-section(side)
              q-btn(
                outline
                no-caps
                icon='las la-edit'
                color='primary'
                @click=''
                :label='$t(`common.actions.edit`)'
              )
          q-separator(inset)
          q-item
            blueprint-icon(icon='resume-template')
            q-item-section
              q-item-label {{$t(`admin.mail.templateResetPwd`)}}
            q-item-section(side)
              q-btn(
                outline
                no-caps
                icon='las la-edit'
                color='primary'
                @click=''
                :label='$t(`common.actions.edit`)'
              )
      //- -----------------------
      //- SMTP TEST
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{$t('admin.mail.test')}}
        q-item
          blueprint-icon.self-start(icon='email')
          q-item-section
            q-item-label {{$t(`admin.mail.testRecipient`)}}
            q-item-label(caption) {{$t(`admin.mail.testRecipientHint`)}}
            q-input.q-mt-md(
              outlined
              v-model='testEmail'
              dense
              :aria-label='$t(`admin.mail.testRecipient`)'
              )
        .flex.justify-end.q-pr-md.q-py-sm
          q-btn(
            unelevated
            color='primary'
            icon='las la-paper-plane'
            :label='$t(`admin.mail.testSend`)'
            @click='sendTest'
            :loading='testLoading'
          )

</template>

<script>
import toSafeInteger from 'lodash/toSafeInteger'
import _get from 'lodash/get'
import cloneDeep from 'lodash/cloneDeep'
import gql from 'graphql-tag'
import { createMetaMixin } from 'quasar'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.mail.title')
      }
    })
  ],
  data () {
    return {
      config: {
        senderName: '',
        senderEmail: '',
        host: '',
        port: 0,
        secure: false,
        verifySSL: false,
        user: '',
        pass: '',
        useDKIM: false,
        dkimDomainName: '',
        dkimKeySelector: '',
        dkimPrivateKey: ''
      },
      testEmail: '',
      testLoading: false,
      loading: 0
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    async load () {
      this.loading++
      try {
        const resp = await this.$apollo.query({
          query: gql`
            query getMailConfig {
              mailConfig {
                senderName
                senderEmail
                host
                port
                secure
                verifySSL
                user
                pass
                useDKIM
                dkimDomainName
                dkimKeySelector
                dkimPrivateKey
              }
            }
          `,
          fetchPolicy: 'no-cache'
        })
        if (!resp?.data?.mailConfig) {
          throw new Error('Failed to fetch mail config.')
        }
        this.config = cloneDeep(resp.data.mailConfig)
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: 'Failed to fetch mail config',
          caption: err.message
        })
      }
      this.loading--
    },
    async save () {
      if (this.loading > 0) { return }

      this.loading++
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation saveMailConfig (
              $senderName: String!
              $senderEmail: String!
              $host: String!
              $port: Int!
              $secure: Boolean!
              $verifySSL: Boolean!
              $user: String!
              $pass: String!
              $useDKIM: Boolean!
              $dkimDomainName: String!
              $dkimKeySelector: String!
              $dkimPrivateKey: String!
            ) {
              updateMailConfig (
                senderName: $senderName
                senderEmail: $senderEmail
                host: $host
                port: $port
                secure: $secure
                verifySSL: $verifySSL
                user: $user
                pass: $pass
                useDKIM: $useDKIM
                dkimDomainName: $dkimDomainName
                dkimKeySelector: $dkimKeySelector
                dkimPrivateKey: $dkimPrivateKey
              ) {
                status {
                  succeeded
                  slug
                  message
                }
              }
            }
          `,
          variables: {
            senderName: this.config.senderName || '',
            senderEmail: this.config.senderEmail || '',
            host: this.config.host || '',
            port: toSafeInteger(this.config.port) || 0,
            secure: this.config.secure ?? false,
            verifySSL: this.config.verifySSL ?? false,
            user: this.config.user || '',
            pass: this.config.pass || '',
            useDKIM: this.config.useDKIM ?? false,
            dkimDomainName: this.config.dkimDomainName || '',
            dkimKeySelector: this.config.dkimKeySelector || '',
            dkimPrivateKey: this.config.dkimPrivateKey || ''
          }
        })
        this.$q.notify({
          type: 'positive',
          message: this.$t('admin.mail.saveSuccess')
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.loading--
    },
    async sendTest () {
      this.loading++
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation sentMailTest (
              $recipientEmail: String!
              ) {
              sendMailTest(
                recipientEmail: $recipientEmail
              ) {
                status {
                  succeeded
                  slug
                  message
                }
              }
            }
          `,
          variables: {
            recipientEmail: this.testEmail
          }
        })
        if (!_get(resp, 'data.sendMailTest.status.succeeded', false)) {
          throw new Error(_get(resp, 'data.sendMailTest.status.message', 'An unexpected error occurred.'))
        }

        this.testEmail = ''
        this.$q.notify({
          type: 'positive',
          message: this.$t('admin.mail.sendTestSuccess')
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.loading--
    }
  }
}
</script>

<style lang='scss'>

</style>
