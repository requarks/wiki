<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{t(`admin.sites.new`)}}
    q-form.q-py-sm(ref='createSiteForm')
      q-item
        blueprint-icon(icon='home')
        q-item-section
          q-input(
            outlined
            v-model='state.siteName'
            dense
            :rules='siteNameValidation'
            hide-bottom-space
            :label='t(`common.field.name`)'
            :aria-label='t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon.self-start(icon='dns')
        q-item-section
          q-input(
            outlined
            v-model='state.siteHostname'
            dense
            :rules='siteHostnameValidation'
            :hint='t(`admin.sites.hostnameHint`)'
            hide-bottom-space
            :label='t(`admin.sites.hostname`)'
            :aria-label='t(`admin.sites.hostname`)'
            lazy-rules='ondemand'
            )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        unelevated
        :label='t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive, ref } from 'vue'

import { useAdminStore } from '../stores/admin'

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const adminStore = useAdminStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  siteName: '',
  siteHostname: 'wiki.example.com',
  isLoading: false
})

// REFS

const createSiteForm = ref(null)

// VALIDATION RULES

const siteNameValidation = [
  val => val.length > 0 || t('admin.sites.nameMissing'),
  val => /^[^<>"]+$/.test(val) || t('admin.sites.nameInvalidChars')
]
const siteHostnameValidation = [
  val => val.length > 0 || t('admin.sites.hostnameMissing'),
  val => /^(\\*)|([a-z0-9\-.:]+)$/.test(val) || t('admin.sites.hostnameInvalidChars')
]

// METHODS

async function create () {
  state.isLoading = true
  try {
    const isFormValid = await createSiteForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.sites.createInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation createSite (
          $hostname: String!
          $title: String!
          ) {
          createSite(
            hostname: $hostname
            title: $title
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        hostname: state.siteHostname,
        title: state.siteName
      }
    })
    if (resp?.data?.createSite?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.sites.createSuccess')
      })
      await adminStore.fetchSites()
      onDialogOK()
    } else {
      throw new Error(resp?.data?.createSite?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
