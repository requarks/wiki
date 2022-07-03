<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 850px;')
    q-card-section.card-header
      template(v-if='props.hookId')
        q-icon(name='img:/_assets/icons/fluent-pencil-drawing.svg', left, size='sm')
        span {{t(`admin.webhooks.edit`)}}
      template(v-else)
        q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
        span {{t(`admin.webhooks.new`)}}
    //- STATE INFO BAR
    q-card-section.flex.items-center.bg-indigo.text-white(v-if='props.hookId && state.hook.state === `pending`')
      q-spinner-clock.q-mr-sm(
        color='white'
        size='xs'
      )
      .text-caption {{t('admin.webhooks.statePendingHint')}}
    q-card-section.flex.items-center.bg-positive.text-white(v-if='props.hookId && state.hook.state === `success`')
      q-spinner-infinity.q-mr-sm(
        color='white'
        size='xs'
      )
      .text-caption {{t('admin.webhooks.stateSuccessHint')}}
    q-card-section.bg-negative.text-white(v-if='props.hookId && state.hook.state === `error`')
      .flex.items-center
        q-icon.q-mr-sm(
          color='white'
          size='xs'
          name='las la-exclamation-triangle'
        )
        .text-caption {{t('admin.webhooks.stateErrorExplain')}}
      .text-caption.q-pl-lg.q-ml-xs.text-red-2 {{state.hook.lastErrorMessage}}
    //- FORM
    q-form.q-py-sm(ref='editWebhookForm')
      q-item
        blueprint-icon(icon='info-popup')
        q-item-section
          q-input(
            outlined
            v-model='state.hook.name'
            dense
            :rules='hookNameValidation'
            hide-bottom-space
            :label='t(`common.field.name`)'
            :aria-label='t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon(icon='lightning-bolt')
        q-item-section
          q-select(
            outlined
            :options='events'
            v-model='state.hook.events'
            multiple
            map-options
            emit-value
            option-value='key'
            option-label='name'
            options-dense
            dense
            :rules='hookEventsValidation'
            hide-bottom-space
            :label='t(`admin.webhooks.events`)'
            :aria-label='t(`admin.webhooks.events`)'
            lazy-rules='ondemand'
            )
            template(v-slot:selected)
              .text-caption(v-if='state.hook.events.length > 0') {{t(`admin.webhooks.eventsSelected`, state.hook.events.length, { count: state.hook.events.length })}}
              span(v-else) &nbsp;
            template(v-slot:option='{ itemProps, opt, selected, toggleOption }')
              q-item(
                v-bind='itemProps'
                )
                q-item-section(side)
                  q-checkbox(
                    :model-value='selected'
                    @update:model-value='toggleOption(opt)'
                    size='sm'
                    )
                q-item-section(side)
                  q-chip.q-mx-none(
                    size='sm'
                    color='positive'
                    text-color='white'
                    square
                    ) {{opt.type}}
                q-item-section
                  q-item-label {{opt.name}}
      q-item
        blueprint-icon.self-start(icon='unknown-status')
        q-item-section
          q-item-label {{t(`admin.webhooks.url`)}}
          q-item-label(caption) {{t(`admin.webhooks.urlHint`)}}
          q-input.q-mt-sm(
            outlined
            v-model='state.hook.url'
            dense
            :rules='hookUrlValidation'
            hide-bottom-space
            placeholder='https://'
            :aria-label='t(`admin.webhooks.url`)'
            lazy-rules='ondemand'
            )
            template(v-slot:prepend)
              q-chip.q-mx-none(
                color='positive'
                text-color='white'
                square
                size='sm'
              ) POST
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='rescan-document')
        q-item-section
          q-item-label {{t(`admin.webhooks.includeMetadata`)}}
          q-item-label(caption) {{t(`admin.webhooks.includeMetadataHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='state.hook.includeMetadata'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='t(`admin.webhooks.includeMetadata`)'
            )
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='select-all')
        q-item-section
          q-item-label {{t(`admin.webhooks.includeContent`)}}
          q-item-label(caption) {{t(`admin.webhooks.includeContentHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='state.hook.includeContent'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='t(`admin.webhooks.includeContent`)'
            )
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='security-ssl')
        q-item-section
          q-item-label {{t(`admin.webhooks.acceptUntrusted`)}}
          q-item-label(caption) {{t(`admin.webhooks.acceptUntrustedHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='state.hook.acceptUntrusted'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='t(`admin.webhooks.acceptUntrusted`)'
            )
      q-item
        blueprint-icon.self-start(icon='fingerprint-scan')
        q-item-section
          q-item-label {{t(`admin.webhooks.authHeader`)}}
          q-item-label(caption) {{t(`admin.webhooks.authHeaderHint`)}}
          q-input.q-mt-sm(
            outlined
            v-model='state.hook.authHeader'
            dense
            :aria-label='t(`admin.webhooks.authHeader`)'
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
        v-if='props.hookId'
        unelevated
        :label='t(`common.actions.save`)'
        color='primary'
        padding='xs md'
        @click='save'
        :loading='state.isLoading'
        )
      q-btn(
        v-else
        unelevated
        :label='t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='state.isLoading'
        )

    q-inner-loading(:showing='state.isLoading')
      q-spinner(color='accent', size='lg')
</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref } from 'vue'

// PROPS

const props = defineProps({
  hookId: {
    type: String,
    default: null
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isLoading: false,
  hook: {
    name: '',
    events: [],
    url: '',
    acceptUntrusted: false,
    authHeader: '',
    includeMetadata: true,
    includeContent: false,
    state: 'pending',
    lastErrorMessage: ''
  }
})

// COMPUTED

const events = computed(() => ([
  { key: 'page:create', name: t('admin.webhooks.eventCreatePage'), type: t('admin.webhooks.typePage') },
  { key: 'page:edit', name: t('admin.webhooks.eventEditPage'), type: t('admin.webhooks.typePage') },
  { key: 'page:rename', name: t('admin.webhooks.eventRenamePage'), type: t('admin.webhooks.typePage') },
  { key: 'page:delete', name: t('admin.webhooks.eventDeletePage'), type: t('admin.webhooks.typePage') },
  { key: 'asset:upload', name: t('admin.webhooks.eventUploadAsset'), type: t('admin.webhooks.typeAsset') },
  { key: 'asset:edit', name: t('admin.webhooks.eventEditAsset'), type: t('admin.webhooks.typeAsset') },
  { key: 'asset:rename', name: t('admin.webhooks.eventRenameAsset'), type: t('admin.webhooks.typeAsset') },
  { key: 'asset:delete', name: t('admin.webhooks.eventDeleteAsset'), type: t('admin.webhooks.typeAsset') },
  { key: 'comment:new', name: t('admin.webhooks.eventNewComment'), type: t('admin.webhooks.typeComment') },
  { key: 'comment:edit', name: t('admin.webhooks.eventEditComment'), type: t('admin.webhooks.typeComment') },
  { key: 'comment:delete', name: t('admin.webhooks.eventDeleteComment'), type: t('admin.webhooks.typeComment') },
  { key: 'user:join', name: t('admin.webhooks.eventUserJoin'), type: t('admin.webhooks.typeUser') },
  { key: 'user:login', name: t('admin.webhooks.eventUserLogin'), type: t('admin.webhooks.typeUser') },
  { key: 'user:logout', name: t('admin.webhooks.eventUserLogout'), type: t('admin.webhooks.typeUser') }
]))

// REFS

const editWebhookForm = ref(null)

// VALIDATION RULES

const hookNameValidation = [
  val => val.length > 0 || t('admin.webhooks.nameMissing'),
  val => /^[^<>"]+$/.test(val) || t('admin.webhooks.nameInvalidChars')
]
const hookEventsValidation = [
  val => val.length > 0 || t('admin.webhooks.eventsMissing')
]
const hookUrlValidation = [
  val => (val.length > 0 && val.startsWith('http')) || t('admin.webhooks.urlMissing'),
  val => /^[^<>"]+$/.test(val) || t('admin.webhooks.urlInvalidChars')
]

// METHODS

async function fetchHook (id) {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getHook (
          $id: UUID!
          ) {
          hookById (
            id: $id
            ) {
            name
            events
            url
            includeMetadata
            includeContent
            acceptUntrusted
            authHeader
            state
            lastErrorMessage
          }
        }
      `,
      fetchPolicy: 'no-cache',
      variables: { id }
    })
    if (resp?.data?.hookById) {
      state.hook = cloneDeep(resp.data.hookById)
    } else {
      throw new Error('Failed to fetch webhook configuration.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
    onDialogHide()
  }
  state.isLoading = false
}

async function create () {
  state.isLoading = true
  try {
    const isFormValid = await editWebhookForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.webhooks.createInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation createHook (
          $name: String!
          $events: [String]!
          $url: String!
          $includeMetadata: Boolean!
          $includeContent: Boolean!
          $acceptUntrusted: Boolean!
          $authHeader: String
          ) {
          createHook (
            name: $name
            events: $events
            url: $url
            includeMetadata: $includeMetadata
            includeContent: $includeContent
            acceptUntrusted: $acceptUntrusted
            authHeader: $authHeader
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: state.hook
    })
    if (resp?.data?.createHook?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.webhooks.createSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.createHook?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}

async function save () {
  state.isLoading = true
  try {
    const isFormValid = await editWebhookForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.webhooks.createInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveHook (
          $id: UUID!
          $patch: HookUpdateInput!
          ) {
          updateHook (
            id: $id
            patch: $patch
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.hookId,
        patch: {
          name: state.hook.name,
          events: state.hook.events,
          url: state.hook.url,
          acceptUntrusted: state.hook.acceptUntrusted,
          authHeader: state.hook.authHeader,
          includeMetadata: state.hook.includeMetadata,
          includeContent: state.hook.includeContent
        }
      }
    })
    if (resp?.data?.updateHook?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.webhooks.updateSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.updateHook?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}

// MOUNTED

onMounted(() => {
  if (props.hookId) {
    fetchHook(props.hookId)
  }
})

</script>
