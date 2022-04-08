<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{$t(`admin.sites.delete`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.sites.deleteConfirm')
          template(v-slot:siteTitle)
            strong {{site.title}}
      .text-body2.q-mt-md
        strong.text-negative {{$t(`admin.sites.deleteConfirmWarn`)}}
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
    site: {
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
        const siteId = this.site.id
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation deleteSite ($id: UUID!) {
              deleteSite(id: $id) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            id: siteId
          }
        })
        if (resp?.data?.deleteSite?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.sites.deleteSuccess')
          })
          this.$store.set('admin/sites', this.$store.get('admin/sites').filter(s => s.id !== siteId))
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.deleteSite?.status?.message || 'An unexpected error occured.')
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
