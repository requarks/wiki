<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card
      .dialog-header.is-short(:style='`background-color: ${colors.blue[500]} !important;`')
        v-icon.mr-2(color='white') mdi-alert
        span(:style='`color: ${colors.textLight.inverse};`') {{$t('editor:unsaved.title')}}
      v-card-text.pt-4
        .body-2(:style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`') {{$t('editor:unsaved.body')}}
      v-card-chin
        v-spacer
        v-btn.btn-rounded(
          outlined
          rounded
          :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
          @click='isShown = false'
          )
          span.text-none.text-uppercase {{$t('common:actions.cancel')}}
        v-btn.btn-rounded(
          rounded
          dark
          :color='colors.red[450]'
          @click='discard'
          )
          v-icon(left, color='white') mdi-delete-forever
          span.text-none.text-uppercase(:style='`color: ${colors.textLight.inverse};`') {{$t('common:actions.discardChanges')}}
</template>

<script>
import colors from '@/themes/default/js/color-scheme'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      colors
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    }
  },
  methods: {
    async discard() {
      this.isShown = false
      this.$emit('discard', true)
    }
  }
}
</script>

<style lang="scss">
.v-btn.btn-rounded {
  border-radius: 20px;
  
  // Fix text rendering issues
  span {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-weight: 500;
  }
}

// Ensure dialog header has proper styling
.dialog-header {
  span {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-weight: 500;
  }
}
</style>
