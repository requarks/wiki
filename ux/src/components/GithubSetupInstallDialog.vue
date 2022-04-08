<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide', persistent)
  q-card(style='min-width: 350px; max-width: 550px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/ultraviolet-github.svg', left, size='sm')
      span {{$t(`admin.storage.githubSetupInstallApp`)}}
    q-card-section
      .text-body2 {{$t(`admin.storage.githubSetupInstallAppInfo`)}}
      .text-body2.q-mt-md: strong.text-deep-orange {{$t('admin.storage.githubSetupInstallAppSelect')}}
      .text-body2.q-mt-md {{$t(`admin.storage.githubSetupInstallAppReturn`)}}
    q-card-actions.card-actions
      q-space
      q-btn(
        unelevated
        :label='$t(`admin.storage.githubSetupContinue`)'
        color='positive'
        padding='xs md'
        @click='confirm'
        )
</template>

<script>

export default {
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
    confirm () {
      this.$emit('ok')
      this.hide()
    }
  }
}
</script>
