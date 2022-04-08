<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-shutdown.svg', left, size='sm')
      span {{value ? $t(`admin.sites.activate`) : $t(`admin.sites.deactivate`)}}
    q-card-section
      .text-body2
        i18n-t(:keypath='value ? `admin.sites.activateConfirm` : `admin.sites.deactivateConfirm`')
          template(v-slot:siteTitle)
            strong {{site.title}}
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
        :label='value ? $t(`common.actions.activate`) : $t(`common.actions.deactivate`)'
        :color='value ? `positive` : `negative`'
        padding='xs md'
        @click='confirm'
        )
</template>

<script>
import gql from 'graphql-tag'
import cloneDeep from 'lodash/cloneDeep'

export default {
  props: {
    site: {
      type: Object
    },
    value: {
      type: Boolean,
      default: false
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
            mutation updateSite (
              $id: UUID!
              $newState: Boolean
              ) {
              updateSite(
                id: $id
                patch: {
                  isEnabled: $newState
                }
                ) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            id: siteId,
            newState: this.value
          }
        })
        if (resp?.data?.updateSite?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.sites.updateSuccess')
          })
          this.$store.set('admin/sites', this.$store.get('admin/sites').map(s => {
            if (s.id === siteId) {
              const ns = cloneDeep(s)
              ns.isEnabled = this.value
              return ns
            } else {
              return s
            }
          }))
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.updateSite?.status?.message || 'An unexpected error occured.')
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
