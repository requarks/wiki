<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-new-post.svg', alt='Mail', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:mail.title') }}
            .subheading.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:mail.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card.wiki-form.animated.fadeInUp
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:mail.configuration') }}
                  v-subheader {{ $t('admin:mail.sender') }}
                  .px-3.pb-3
                    v-text-field(
                      outlined
                      v-model='config.senderName'
                      :label='$t(`admin:mail.senderName`)'
                      required
                      :counter='255'
                      prepend-icon='person'
                      )
                    v-text-field(
                      outlined
                      v-model='config.senderEmail'
                      :label='$t(`admin:mail.senderEmail`)'
                      required
                      :counter='255'
                      prepend-icon='email'
                      )
                  v-divider
                  v-subheader {{ $t('admin:mail.smtp') }}
                  .px-3.pb-3
                    v-text-field(
                      outlined
                      v-model='config.host'
                      :label='$t(`admin:mail.smtpHost`)'
                      required
                      :counter='255'
                      prepend-icon='memory'
                      )
                    v-text-field(
                      outlined
                      v-model='config.port'
                      :label='$t(`admin:mail.smtpPort`)'
                      required
                      prepend-icon='router'
                      persistent-hint
                      :hint='$t(`admin:mail.smtpPortHint`)'
                      style='max-width: 300px;'
                      )
                    v-switch(
                      v-model='config.secure'
                      :label='$t(`admin:mail.smtpTLS`)'
                      color='primary'
                      persistent-hint
                      :hint='$t(`admin:mail.smtpTLSHint`)'
                      prepend-icon='vpn_lock'
                      )
                    v-text-field.mt-3(
                      outlined
                      v-model='config.user'
                      :label='$t(`admin:mail.smtpUser`)'
                      required
                      :counter='255'
                      prepend-icon='lock_outline'
                      )
                    v-text-field(
                      outlined
                      v-model='config.pass'
                      :label='$t(`admin:mail.smtpPwd`)'
                      required
                      prepend-icon='lock'
                      type='password'
                      )

            v-flex(lg6 xs12)
              v-card.wiki-form.animated.fadeInUp.wait-p2s
                v-form
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:mail.dkim') }}
                  .pa-3
                    .body-2.grey--text.text--darken-2 {{ $t('admin:mail.dkimHint') }}
                    v-switch(
                      v-model='config.useDKIM'
                      :label='$t(`admin:mail.dkimUse`)'
                      color='primary'
                      prepend-icon='vpn_key'
                      )
                    v-text-field(
                      outlined
                      v-model='config.dkimDomainName'
                      :label='$t(`admin:mail.dkimDomainName`)'
                      :counter='255'
                      prepend-icon='vpn_key'
                      :disabled='!config.useDKIM'
                      )
                    v-text-field(
                      outlined
                      v-model='config.dkimKeySelector'
                      :label='$t(`admin:mail.dkimKeySelector`)'
                      :counter='255'
                      prepend-icon='vpn_key'
                      :disabled='!config.useDKIM'
                      )
                    v-text-field(
                      outlined
                      v-model='config.dkimPrivateKey'
                      :label='$t(`admin:mail.dkimPrivateKey`)'
                      prepend-icon='vpn_key'
                      persistent-hint
                      :hint='$t(`admin:mail.dkimPrivateKeyHint`)'
                      :disabled='!config.useDKIM'
                      )

              v-card.mt-3.wiki-form.animated.fadeInUp.wait-p3s
                v-form
                  v-toolbar(color='teal', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:mail.test') }}
                  .pa-3
                    .body-2.grey--text.text--darken-2 {{ $t('admin:mail.testHint') }}
                    v-text-field.mt-3(
                      outlined
                      v-model='testEmail'
                      :label='$t(`admin:mail.testRecipient`)'
                      :counter='255'
                      prepend-icon='mail'
                      :disabled='testLoading'
                      )
                  v-card-chin
                    v-spacer
                    v-btn(color='teal', dark, @click='sendTest', :loading='testLoading') {{ $t('admin:mail.testSend') }}

</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import mailConfigQuery from 'gql/admin/mail/mail-query-config.gql'
import mailUpdateConfigMutation from 'gql/admin/mail/mail-mutation-save-config.gql'
import mailTestMutation from 'gql/admin/mail/mail-mutation-sendtest.gql'

export default {
  data() {
    return {
      config: {
        senderName: '',
        senderEmail: '',
        host: '',
        port: 0,
        secure: false,
        user: '',
        pass: '',
        useDKIM: false,
        dkimDomainName: '',
        dkimKeySelector: '',
        dkimPrivateKey: ''
      },
      testEmail: '',
      testLoading: false
    }
  },
  computed: {
    darkMode: get('site/dark')
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: mailUpdateConfigMutation,
          variables: {
            senderName: this.config.senderName || '',
            senderEmail: this.config.senderEmail || '',
            host: this.config.host || '',
            port: _.toSafeInteger(this.config.port) || 0,
            secure: this.config.secure || false,
            user: this.config.user || '',
            pass: this.config.pass || '',
            useDKIM: this.config.useDKIM || false,
            dkimDomainName: this.config.dkimDomainName || '',
            dkimKeySelector: this.config.dkimKeySelector || '',
            dkimPrivateKey: this.config.dkimPrivateKey || ''
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-mail-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:mail.saveSuccess'),
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async sendTest () {
      try {
        const resp = await this.$apollo.mutate({
          mutation: mailTestMutation,
          variables: {
            recipientEmail: this.testEmail
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-mail-test')
          }
        })
        if (!_.get(resp, 'data.mail.sendTest.responseResult.succeeded', false)) {
          throw new Error(_.get(resp, 'data.mail.sendTest.responseResult.message', 'An unexpected error occured.'))
        }

        this.testEmail = ''
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:mail.sendTestSuccess'),
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    config: {
      query: mailConfigQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.mail.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-mail-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
