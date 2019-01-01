<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card.wiki-form
      .dialog-header.is-short.is-red
        v-icon.mr-2(color='white') warning
        span Discard Unsaved Changes?
      v-card-text
        .body-2 You have unsaved changes. Are you sure you want to leave the editor and discard any modifications you made since the last save?
      v-card-chin
        v-spacer
        v-btn(flat, @click='isShown = false') Cancel
        v-btn(color='red', @click='discard', dark) Discard Changes
</template>

<script>

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return { }
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
