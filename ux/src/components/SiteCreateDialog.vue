<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{$t(`admin.sites.new`)}}
    q-form.q-py-sm(ref='createSiteForm')
      q-item
        blueprint-icon(icon='home')
        q-item-section
          q-input(
            outlined
            v-model='siteName'
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.sites.nameMissing'),
              val => /^[^<>"]+$/.test(val) || $t('admin.sites.nameInvalidChars')
            ]`
            hide-bottom-space
            :label='$t(`common.field.name`)'
            :aria-label='$t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon.self-start(icon='dns')
        q-item-section
          q-input(
            outlined
            v-model='siteHostname'
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.sites.hostnameMissing'),
              val => /^(\\*)|([a-z0-9\-.:]+)$/.test(val) || $t('admin.sites.hostnameInvalidChars')
            ]`
            :hint='$t(`admin.sites.hostnameHint`)'
            hide-bottom-space
            :label='$t(`admin.sites.hostname`)'
            :aria-label='$t(`admin.sites.hostname`)'
            lazy-rules='ondemand'
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
        unelevated
        :label='$t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='isLoading'
        )
</template>

<script>
import gql from 'graphql-tag'

export default {
  emits: ['ok', 'hide'],
  data () {
    return {
      siteName: '',
      siteHostname: 'wiki.example.com',
      isLoading: false
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
    async create () {
      this.isLoading = true
      try {
        const isFormValid = await this.$refs.createSiteForm.validate(true)
        if (!isFormValid) {
          throw new Error(this.$t('admin.sites.createInvalidData'))
        }
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation createSite (
              $hostname: String!
              $title: String!
              ) {
              createSite(
                hostname: $hostname
                title: $title
                ) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            hostname: this.siteHostname,
            title: this.siteName
          }
        })
        if (resp?.data?.createSite?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.sites.createSuccess')
          })
          await this.$store.dispatch('admin/fetchSites')
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.createSite?.status?.message || 'An unexpected error occured.')
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: err.message
        })
      }
      this.isLoading = false
    }
  }
}
</script>
