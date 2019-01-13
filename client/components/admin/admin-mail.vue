<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-new-post.svg', alt='Mail', style='width: 80px;')
          .admin-header-title
            .headline.primary--text {{ $t('admin:mail.title') }}
            .subheading.grey--text {{ $t('admin:mail.subtitle') }}
          v-spacer
          v-btn(color='success', depressed, @click='save', large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card.wiki-form
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:mail.configuration') }}
                  v-subheader Sender
                  .px-3.pb-3
                    v-text-field(
                      outline
                      v-model='config.senderName'
                      label='Sender Name'
                      required
                      :counter='255'
                      prepend-icon='person'
                      )
                    v-text-field(
                      outline
                      v-model='config.senderEmail'
                      label='Sender Email'
                      required
                      :counter='255'
                      prepend-icon='email'
                      )
                  v-divider
                  v-subheader SMTP Settings
                  .px-3.pb-3
                    v-text-field(
                      outline
                      v-model='config.host'
                      label='Host'
                      required
                      :counter='255'
                      prepend-icon='memory'
                      )
                    v-text-field(
                      outline
                      v-model='config.port'
                      label='Port'
                      required
                      prepend-icon='router'
                      persistent-hint
                      hint='Usually 465 (recommended), 587 or 25.'
                      style='max-width: 300px;'
                      )
                    v-switch(
                      v-model='config.secure'
                      label='Secure (TLS)'
                      color='primary'
                      persistent-hint
                      hint='Should be enabled when using port 465, otherwise turned off (587 or 25).'
                      prepend-icon='vpn_lock'
                      )
                    v-text-field.mt-3(
                      outline
                      v-model='config.user'
                      label='Username'
                      required
                      :counter='255'
                      prepend-icon='lock_outline'
                      )
                    v-text-field(
                      outline
                      v-model='config.pass'
                      label='Password'
                      required
                      prepend-icon='lock'
                      type='password'
                      )

            v-flex(lg6 xs12)
              v-card.wiki-form
                v-form
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:mail.dkim') }}
                  .pa-3
                    .body-2.grey--text.text--darken-2 DKIM (DomainKeys Identified Mail) provides a layer of security on all emails sent from Wiki.js by providing the means for recipients to validate the domain name and ensure the message authenticity.
                    v-switch(
                      v-model='config.useDKIM'
                      label='Use DKIM'
                      color='primary'
                      prepend-icon='vpn_key'
                      )
                    v-text-field(
                      outline
                      v-model='config.dkimDomainName'
                      label='Domain Name'
                      :counter='255'
                      prepend-icon='vpn_key'
                      :disabled='!config.useDKIM'
                      )
                    v-text-field(
                      outline
                      v-model='config.dkimKeySelector'
                      label='Key Selector'
                      :counter='255'
                      prepend-icon='vpn_key'
                      :disabled='!config.useDKIM'
                      )
                    v-text-field(
                      outline
                      v-model='config.dkimPrivateKey'
                      label='Private Key'
                      prepend-icon='vpn_key'
                      persistent-hint
                      hint='Private key for the selector in PEM format'
                      :disabled='!config.useDKIM'
                      )

</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import mailConfigQuery from 'gql/admin/mail/mail-query-config.gql'
import mailUpdateConfigMutation from 'gql/admin/mail/mail-mutation-save-config.gql'

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
      }
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
          message: 'Configuration saved successfully.',
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
