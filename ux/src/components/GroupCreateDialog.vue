<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{$t(`admin.groups.create`)}}
    q-form.q-py-sm(ref='createGroupForm', @submit='create')
      q-item
        blueprint-icon(icon='team')
        q-item-section
          q-input(
            outlined
            v-model='groupName'
            dense
            :rules=`[
              val => val.length > 0 || $t('admin.groups.nameMissing'),
              val => /^[^<>"]+$/.test(val) || $t('admin.groups.nameInvalidChars')
            ]`
            hide-bottom-space
            :label='$t(`common.field.name`)'
            :aria-label='$t(`common.field.name`)'
            lazy-rules='ondemand'
            autofocus
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
      groupName: '',
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
        const isFormValid = await this.$refs.createGroupForm.validate(true)
        if (!isFormValid) {
          throw new Error(this.$t('admin.groups.createInvalidData'))
        }
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation createGroup (
              $name: String!
              ) {
              createGroup(
                name: $name
                ) {
                status {
                  succeeded
                  message
                }
              }
            }
          `,
          variables: {
            name: this.groupName
          }
        })
        if (resp?.data?.createGroup?.status?.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.groups.createSuccess')
          })
          this.$emit('ok')
          this.hide()
        } else {
          throw new Error(resp?.data?.createGroup?.status?.message || 'An unexpected error occured.')
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
