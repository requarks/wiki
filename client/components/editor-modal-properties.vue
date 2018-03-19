<template lang='pug'>
  v-bottom-sheet(v-model='isShown', inset, persistent)
    v-toolbar(color='blue-grey', flat)
      v-icon(color='white') sort_by_alpha
      v-toolbar-title.white--text Page Properties
      v-spacer
      v-btn(icon, dark, @click.native='close')
        v-icon close
    v-card.pa-3(tile)
      v-card-text
        v-form
          v-text-field(label='Title', counter='255')
          v-text-field(label='Short Description', counter='255')
          v-select(label='Tags', chips, tags, deletable-chips)
          v-text-field(label='Path', prefix='/', append-icon='folder')
      v-card-actions
        v-btn(color='green', dark) Save
        v-btn(@click.native='close') Cancel
</template>

<script>
export default {
  data() {
    return {
      isShown: false
    }
  },
  mounted() {
    this.isShown = true
  },
  methods: {
    close() {
      this.isShown = false
      this.$parent.$parent.closeModal()
    }
  }
}
</script>

<style lang='scss'>

</style>
