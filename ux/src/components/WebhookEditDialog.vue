<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 850px;')
    q-card-section.card-header
      template(v-if='hookId')
        q-icon(name='img:/_assets/icons/fluent-pencil-drawing.svg', left, size='sm')
        span {{$t(`admin.webhooks.edit`)}}
      template(v-else)
        q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
        span {{$t(`admin.webhooks.new`)}}
    //- STATE INFO BAR
    q-card-section.flex.items-center.bg-indigo.text-white(v-if='hookId && hook.state === `pending`')
      q-spinner-clock.q-mr-sm(
        color='white'
        size='xs'
      )
      .text-caption {{$t('admin.webhooks.statePendingHint')}}
    q-card-section.flex.items-center.bg-positive.text-white(v-if='hookId && hook.state === `success`')
      q-spinner-infinity.q-mr-sm(
        color='white'
        size='xs'
      )
      .text-caption {{$t('admin.webhooks.stateSuccessHint')}}
    q-card-section.bg-negative.text-white(v-if='hookId && hook.state === `error`')
      .flex.items-center
        q-icon.q-mr-sm(
          color='white'
          size='xs'
          name='las la-exclamation-triangle'
        )
        .text-caption {{$t('admin.webhooks.stateErrorExplain')}}
      .text-caption.q-pl-lg.q-ml-xs.text-red-2 {{hook.lastErrorMessage}}
    //- FORM
    q-form.q-py-sm(ref='editWebhookForm')
      q-item
        blueprint-icon(icon='info-popup')
        q-item-section
          q-input(
            outlined
            v-model='hook.name'
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.webhooks.nameMissing'),
              val => /^[^<>"]+$/.test(val) || $t('admin.webhooks.nameInvalidChars')
            ]`
            hide-bottom-space
            :label='$t(`common.field.name`)'
            :aria-label='$t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon(icon='lightning-bolt')
        q-item-section
          q-select(
            outlined
            :options='events'
            v-model='hook.events'
            multiple
            map-options
            emit-value
            option-value='key'
            option-label='name'
            options-dense
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.webhooks.eventsMissing')
            ]`
            hide-bottom-space
            :label='$t(`admin.webhooks.events`)'
            :aria-label='$t(`admin.webhooks.events`)'
            lazy-rules='ondemand'
            )
            template(v-slot:selected)
              .text-caption(v-if='hook.events.length > 0') {{$tc(`admin.webhooks.eventsSelected`, hook.events.length, { count: hook.events.length })}}
              span(v-else)
            template(v-slot:option='{ itemProps, itemEvents, opt, selected, toggleOption }')
              q-item(
                v-bind='itemProps'
                v-on='itemEvents'
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
          q-item-label {{$t(`admin.webhooks.url`)}}
          q-item-label(caption) {{$t(`admin.webhooks.urlHint`)}}
          q-input.q-mt-sm(
            outlined
            v-model='hook.url'
            dense
            :rules=`[
              val => (val.length > 0 && val.startsWith('http')) || $t('admin.webhooks.urlMissing'),
              val => /^[^<>"]+$/.test(val) || $t('admin.webhooks.urlInvalidChars')
            ]`
            hide-bottom-space
            placeholder='https://'
            :aria-label='$t(`admin.webhooks.url`)'
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
          q-item-label {{$t(`admin.webhooks.includeMetadata`)}}
          q-item-label(caption) {{$t(`admin.webhooks.includeMetadataHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='hook.includeMetadata'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='$t(`admin.webhooks.includeMetadata`)'
            )
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='select-all')
        q-item-section
          q-item-label {{$t(`admin.webhooks.includeContent`)}}
          q-item-label(caption) {{$t(`admin.webhooks.includeContentHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='hook.includeContent'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='$t(`admin.webhooks.includeContent`)'
            )
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='security-ssl')
        q-item-section
          q-item-label {{$t(`admin.webhooks.acceptUntrusted`)}}
          q-item-label(caption) {{$t(`admin.webhooks.acceptUntrustedHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='hook.acceptUntrusted'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='$t(`admin.webhooks.acceptUntrusted`)'
            )
      q-item
        blueprint-icon.self-start(icon='fingerprint-scan')
        q-item-section
          q-item-label {{$t(`admin.webhooks.authHeader`)}}
          q-item-label(caption) {{$t(`admin.webhooks.authHeaderHint`)}}
          q-input.q-mt-sm(
            outlined
            v-model='hook.authHeader'
            dense
            :aria-label='$t(`admin.webhooks.authHeader`)'
            )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='$t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='hide'
        )
      q-btn(
        v-if='hookId'
        unelevated
        :label='$t(`common.actions.save`)'
        color='primary'
        padding='xs md'
        @click='save'
        :loading='loading'
        )
      q-btn(
        v-else
        unelevated
        :label='$t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='loading'
        )

    q-inner-loading(:showing='loading')
      q-spinner(color='accent', size='lg')
</template>

<script>
import gql from 'graphql-tag'
import cloneDeep from 'lodash/cloneDeep'

import { QSpinnerClock, QSpinnerInfinity } from 'quasar'

export default {
  components: {
    QSpinnerClock,
    QSpinnerInfinity
  },
  props: {
    hookId: {
      type: String,
      default: null
    }
  },
  emits: ['ok', 'hide'],
  data () {
    return {
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
      },
      loading: false
    }
  },
  computed: {
    events () {
      return [
        { key: 'page:create', name: this.$t('admin.webhooks.eventCreatePage'), type: this.$t('admin.webhooks.typePage') },
        { key: 'page:edit', name: this.$t('admin.webhooks.eventEditPage'), type: this.$t('admin.webhooks.typePage') },
        { key: 'page:rename', name: this.$t('admin.webhooks.eventRenamePage'), type: this.$t('admin.webhooks.typePage') },
        { key: 'page:delete', name: this.$t('admin.webhooks.eventDeletePage'), type: this.$t('admin.webhooks.typePage') },
        { key: 'asset:upload', name: this.$t('admin.webhooks.eventUploadAsset'), type: this.$t('admin.webhooks.typeAsset') },
        { key: 'asset:edit', name: this.$t('admin.webhooks.eventEditAsset'), type: this.$t('admin.webhooks.typeAsset') },
        { key: 'asset:rename', name: this.$t('admin.webhooks.eventRenameAsset'), type: this.$t('admin.webhooks.typeAsset') },
        { key: 'asset:delete', name: this.$t('admin.webhooks.eventDeleteAsset'), type: this.$t('admin.webhooks.typeAsset') },
        { key: 'comment:new', name: this.$t('admin.webhooks.eventNewComment'), type: this.$t('admin.webhooks.typeComment') },
        { key: 'comment:edit', name: this.$t('admin.webhooks.eventEditComment'), type: this.$t('admin.webhooks.typeComment') },
        { key: 'comment:delete', name: this.$t('admin.webhooks.eventDeleteComment'), type: this.$t('admin.webhooks.typeComment') },
        { key: 'user:join', name: this.$t('admin.webhooks.eventUserJoin'), type: this.$t('admin.webhooks.typeUser') },
        { key: 'user:login', name: this.$t('admin.webhooks.eventUserLogin'), type: this.$t('admin.webhooks.typeUser') },
        { key: 'user:logout', name: this.$t('admin.webhooks.eventUserLogout'), type: this.$t('admin.webhooks.typeUser') }
      ]
    }
  },
  methods: {
    show () {
      this.$refs.dialog.show()
      if (this.hookId) {
        this.fetchHook(this.hookId)
      }
    },
    hide () {
      this.$refs.dialog.hide()
    },
    onDialogHide () {
      this.$emit('hide')
    },
    async fetchHook (id) {
      this.loading = true
      try {
        const resp = await this.$apollo.query({
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
          this.hook = cloneDeep(resp.data.hookById)
        } else {
          throw new Error('Failed to fetch webhook configuration.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
        this.hide()
      }
      this.loading = false
    },
    async create () {
      this.loading = true
      try {
        const isFormValid = await this.$refs.editWebhookForm.validate(true)
        if (!isFormValid) {
          throw new Error(this.$t('admin.webhooks.createInvalidData'))
        }
        const resp = await this.$apollo.mutate({
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
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: this.hook
        })
        if (resp?.data?.createHook?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.webhooks.createSuccess')
          })
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.createHook?.status?.message || 'An unexpected error occured.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
      }
      this.loading = false
    },
    async save () {
      this.loading = true
      try {
        const isFormValid = await this.$refs.editWebhookForm.validate(true)
        if (!isFormValid) {
          throw new Error(this.$t('admin.webhooks.createInvalidData'))
        }
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation saveHook (
              $id: UUID!
              $patch: HookUpdateInput!
              ) {
              updateHook (
                id: $id
                patch: $patch
                ) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            id: this.hookId,
            patch: {
              name: this.hook.name,
              events: this.hook.events,
              url: this.hook.url,
              acceptUntrusted: this.hook.acceptUntrusted,
              authHeader: this.hook.authHeader,
              includeMetadata: this.hook.includeMetadata,
              includeContent: this.hook.includeContent
            }
          }
        })
        if (resp?.data?.updateHook?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.webhooks.updateSuccess')
          })
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.updateHook?.status?.message || 'An unexpected error occured.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
      }
      this.loading = false
    }
  }
}
</script>
