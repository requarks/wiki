<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{$t(`admin.webhooks.delete`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.webhooks.deleteConfirm')
          template(v-slot:name)
            strong {{hook.name}}
      .text-body2.q-mt-md
        strong.text-negative {{$t(`admin.webhooks.deleteConfirmWarn`)}}
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
        unelevated
        :label='$t(`common.actions.delete`)'
        color='negative'
        padding='xs md'
        @click='confirm'
        )
</template>

<script>
import gql from 'graphql-tag'

export default {
  props: {
    hook: {
      type: Object
    }
  },
  emits: ['ok', 'hide'],
  data () {
    return {
    }
  },
  methods: {
    show () {
      this.$refs.dialog.show()
    },
    hide () {
      this.$refs.dialog.hide()
    },
    onDialogHide () {
      this.$emit('hide')
    },
    async confirm () {
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation deleteHook ($id: UUID!) {
              deleteHook(id: $id) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            id: this.hook.id
          }
        })
        if (resp?.data?.deleteHook?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.webhooks.deleteSuccess')
          })
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.deleteHook?.status?.message || 'An unexpected error occured.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
      }
    }
  }
}
</script>
