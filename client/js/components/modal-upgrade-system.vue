<template lang="pug">
  transition(:duration="400")
    .modal(v-show='isShown', v-cloak)
      transition(name='modal-background')
        .modal-background(v-show='isShown')
      .modal-container
        transition(name='modal-content')
          .modal-content(v-show='isShown')
            template(v-if='step === "running"')
              header.is-blue Install
              section.modal-loading
                i
                span Wiki.js {{ mode }} in progress...
                em Please wait
            template(v-if='step === "error"')
              header.is-red Installation Error
              section.modal-loading
                span {{ error }}
              footer
                a.button.is-grey.is-outlined(@click='upgradeCancel') Abort
                a.button.is-deep-orange(@click='upgradeStart') Try Again
            template(v-if='step === "confirm"')
              header.is-deep-orange Are you sure?
              section
                label.label You are about to {{ mode }} Wiki.js.
                span.note You will not be able to access your wiki during the operation. Content will not be affected. However, it is your responsibility to ensure you have a backup in the unexpected event content gets lost or corrupted.
              footer
                a.button.is-grey.is-outlined(@click='upgradeCancel') Abort
                a.button.is-deep-orange(@click='upgradeStart') Start

</template>

<script>
export default {
  name: 'modal-upgrade-system',
  data() {
    return {
      isLoading: false
    }
  },
  computed: {
    isShown() {
      return this.$store.state.modalUpgradeSystem.shown
    },
    mode() {
      return this.$store.state.modalUpgradeSystem.mode
    },
    step() {
      return this.$store.state.modalUpgradeSystem.step
    }
  },
  methods: {
    upgradeCancel() {
      this.isLoading = false
      this.$store.dispatch('modalUpgradeSystem/close')
    },
    upgradeStart() {
      this.$store.commit('modalUpgradeSystem/stepChange', 'running')
      this.$http.post('/admin/system/install', {
        mode: this.mode
      }).then(resp => {
        // todo
      }).catch(err => {
        this.$store.commit('modalUpgradeSystem/stepChange', 'error')
        this.error = err.body
      })
    }
  }
}
</script>
