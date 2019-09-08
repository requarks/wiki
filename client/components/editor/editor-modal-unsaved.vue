<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card.wiki-form
      .dialog-header.is-short.is-red
        v-icon.mr-2(color='white') mdi-alert
        span {{$t('editor:unsaved.title')}}
      v-card-text.pt-4
        .body-2 {{$t('editor:unsaved.body')}}
      v-card-chin
        v-spacer
        v-btn(text, @click='isShown = false') {{$t('common:actions.cancel')}}
        v-btn.px-4(color='red', @click='discard', dark) {{$t('common:actions.discardChanges')}}
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
