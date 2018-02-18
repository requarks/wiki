<template lang='pug'>
  v-bottom-sheet(v-model='isOpened', inset)
    v-toolbar(color='blue-grey', flat)
      v-icon(color='white') sort_by_alpha
      v-toolbar-title.white--text Document Properties
      v-spacer
      v-btn(icon, dark)
        v-icon close
    v-card.pa-3(tile)
      v-card-text
        v-form
          v-text-field(label='Title', autofocus, loading='primary')
          v-text-field(label='Short Description')
      v-card-actions
        v-btn(color='green', dark) Save
        v-btn Cancel
</template>

<script>
export default {
  props: {
    isOpened: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {

    }
  }
}
</script>

<style lang='scss'>

</style>
