<template lang='pug'>
q-page.admin-mail
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-message-settings-animated.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.mail.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.mail.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/mail`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-7
      //- -----------------------
      //- Configuration
      //- -----------------------
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.mail.configuration')}}
        q-item
          blueprint-icon(icon='contact')
          q-item-section
            q-item-label {{t(`admin.mail.senderName`)}}
            q-item-label(caption) {{t(`admin.general.senderNameHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.senderName'
              dense
              hide-bottom-space
              :aria-label='t(`admin.mail.senderName`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='envelope')
          q-item-section
            q-item-label {{t(`admin.mail.senderEmail`)}}
            q-item-label(caption) {{t(`admin.general.senderEmailHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.senderEmail'
              dense
              :aria-label='t(`admin.mail.senderEmail`)'
              )
      //- -----------------------
      //- SMTP
      //- -----------------------
      q-card.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.mail.smtp')}}
        q-item
          blueprint-icon(icon='dns')
          q-item-section
            q-item-label {{t(`admin.mail.smtpHost`)}}
            q-item-label(caption) {{t(`admin.mail.smtpHostHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.host'
              dense
              hide-bottom-space
              :aria-label='t(`admin.mail.smtpHost`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='ethernet-off')
          q-item-section
            q-item-label {{t(`admin.mail.smtpPort`)}}
            q-item-label(caption) {{t(`admin.mail.smtpPortHint`)}}
          q-item-section(style='flex: 0 0 120px;')
            q-input(
              outlined
              v-model='state.config.port'
              dense
              :aria-label='t(`admin.mail.smtpPort`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='server')
          q-item-section
            q-item-label {{t(`admin.mail.smtpName`)}}
            q-item-label(caption) {{t(`admin.mail.smtpNameHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.name'
              dense
              hide-bottom-space
              :aria-label='t(`admin.mail.smtpName`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='secure')
          q-item-section
            q-item-label {{t(`admin.mail.smtpTLS`)}}
            q-item-label(caption) {{t(`admin.mail.smtpTLSHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.secure'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.mail.smtpTLS`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label')
          blueprint-icon(icon='security-ssl')
          q-item-section
            q-item-label {{t(`admin.mail.smtpVerifySSL`)}}
            q-item-label(caption) {{t(`admin.mail.smtpVerifySSLHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.verifySSL'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.mail.smtpVerifySSL`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='test-account')
          q-item-section
            q-item-label {{t(`admin.mail.smtpUser`)}}
            q-item-label(caption) {{t(`admin.mail.smtpUserHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.user'
              dense
              :aria-label='t(`admin.mail.smtpUser`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='password')
          q-item-section
            q-item-label {{t(`admin.mail.smtpPwd`)}}
            q-item-label(caption) {{t(`admin.mail.smtpPwdHint`)}}
          q-item-section
            q-input(
              outlined
              v-model='state.config.pass'
              dense
              :aria-label='t(`admin.mail.smtpPwd`)'
              )
      //- -----------------------
      //- DKIM
      //- -----------------------
      q-card.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.mail.dkim')}}
        q-item.q-pt-none
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section.text-caption {{ t('admin.mail.dkimHint') }}
        q-item(tag='label')
          blueprint-icon(icon='received')
          q-item-section
            q-item-label {{t(`admin.mail.dkimUse`)}}
            q-item-label(caption) {{t(`admin.mail.dkimUseHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.useDKIM'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.mail.dkimUse`)'
              )
        template(v-if='state.config.useDKIM')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='dns')
            q-item-section
              q-item-label {{t(`admin.mail.dkimDomainName`)}}
              q-item-label(caption) {{t(`admin.mail.dkimDomainNameHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.config.dkimDomainName'
                dense
                :aria-label='t(`admin.mail.dkimDomainName`)'
                )
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='access')
            q-item-section
              q-item-label {{t(`admin.mail.dkimKeySelector`)}}
              q-item-label(caption) {{t(`admin.mail.dkimKeySelectorHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.config.dkimKeySelector'
                dense
                :aria-label='t(`admin.mail.dkimKeySelector`)'
                )
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='grand-master-key')
            q-item-section
              q-item-label {{t(`admin.mail.dkimPrivateKey`)}}
              q-item-label(caption) {{t(`admin.mail.dkimPrivateKeyHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.config.dkimPrivateKey'
                dense
                :aria-label='t(`admin.mail.dkimPrivateKey`)'
                type='textarea'
                )

    .col-12.col-lg-5
      //- -----------------------
      //- MAIL TEMPLATES
      //- -----------------------
      q-card.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.mail.templates')}}
        q-list
          q-item
            blueprint-icon(icon='resume-template')
            q-item-section
              q-item-label {{t(`admin.mail.templateWelcome`)}}
            q-item-section(side)
              q-btn(
                outline
                no-caps
                icon='las la-edit'
                color='primary'
                @click=''
                :label='t(`common.actions.edit`)'
              )
          q-separator(inset)
          q-item
            blueprint-icon(icon='resume-template')
            q-item-section
              q-item-label {{t(`admin.mail.templateResetPwd`)}}
            q-item-section(side)
              q-btn(
                outline
                no-caps
                icon='las la-edit'
                color='primary'
                @click=''
                :label='t(`common.actions.edit`)'
              )
      //- -----------------------
      //- SMTP TEST
      //- -----------------------
      q-card.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.mail.test')}}
        q-item
          blueprint-icon.self-start(icon='email')
          q-item-section
            q-item-label {{t(`admin.mail.testRecipient`)}}
            q-item-label(caption) {{t(`admin.mail.testRecipientHint`)}}
            q-input.q-mt-md(
              outlined
              v-model='state.testEmail'
              dense
              :aria-label='t(`admin.mail.testRecipient`)'
              )
        .flex.justify-end.q-pr-md.q-py-sm
          q-btn(
            unelevated
            color='primary'
            icon='las la-paper-plane'
            :label='t(`admin.mail.testSend`)'
            @click='sendTest'
            :loading='state.testLoading'
          )

</template>

<script setup>
import { cloneDeep, toSafeInteger } from 'lodash-es'
import gql from 'graphql-tag'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.mail.title')
})

// DATA

const state = reactive({
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
})

// METHODS
async function load () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.query({
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
      fetchPolicy: 'network-only'
    })
    if (!resp?.data?.mailConfig) {
      throw new Error('Failed to fetch mail config.')
    }
    state.config = cloneDeep(resp.data.mailConfig)
    adminStore.info.isMailConfigured = state.config?.host?.length > 2
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch mail config',
      caption: err.message
    })
  }
  state.loading--
}

async function save () {
  if (state.loading > 0) { return }

  state.loading++
  try {
    await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveMailConfig (
          $senderName: String!
          $senderEmail: String!
          $host: String!
          $port: Int!
          $name: String!
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
            name: $name
            secure: $secure
            verifySSL: $verifySSL
            user: $user
            pass: $pass
            useDKIM: $useDKIM
            dkimDomainName: $dkimDomainName
            dkimKeySelector: $dkimKeySelector
            dkimPrivateKey: $dkimPrivateKey
          ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        senderName: state.config.senderName || '',
        senderEmail: state.config.senderEmail || '',
        host: state.config.host || '',
        port: toSafeInteger(state.config.port) || 0,
        name: state.config.name || '',
        secure: state.config.secure ?? false,
        verifySSL: state.config.verifySSL ?? false,
        user: state.config.user || '',
        pass: state.config.pass || '',
        useDKIM: state.config.useDKIM ?? false,
        dkimDomainName: state.config.dkimDomainName || '',
        dkimKeySelector: state.config.dkimKeySelector || '',
        dkimPrivateKey: state.config.dkimPrivateKey || ''
      }
    })
    $q.notify({
      type: 'positive',
      message: t('admin.mail.saveSuccess')
    })
    adminStore.info.isMailConfigured = state.config?.host?.length > 2
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

async function sendTest () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation sentMailTest (
          $recipientEmail: String!
          ) {
          sendMailTest(
            recipientEmail: $recipientEmail
          ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        recipientEmail: state.testEmail
      }
    })
    if (!resp?.data?.sendMailTest?.operation?.succeeded) {
      throw new Error(resp?.data?.sendMailTest?.operation?.message || 'An unexpected error occurred.')
    }

    state.testEmail = ''
    $q.notify({
      type: 'positive',
      message: t('admin.mail.sendTestSuccess')
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang='scss'>

</style>
