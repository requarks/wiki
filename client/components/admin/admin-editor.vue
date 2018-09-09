<template lang='pug'>
  v-card(tile, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"')
    .pa-3.pt-4
      .admin-header-icon: v-icon(size='80', color='grey lighten-2') transform
      .headline.primary--text Editor
      .subheading.grey--text Configure the content editor
    v-tabs(:color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(key='code') Markdown

      v-tab-item(key='settings', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          .body-2.grey--text.text--darken-1 Select which editors to enable:
          .caption.grey--text.pb-2 Some editors require additional configuration in their dedicated tab (when selected).
          v-form
            v-radio-group(v-model='selectedEditor')
              v-radio(v-for='(editor, n) in editors', :key='n', :label='editor.text', :value='editor.value', color='primary')
      v-tab-item(key='code', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          v-form
            v-subheader Editor Configuration
            .body-1.ml-3 This editor has no configuration options you can modify.
    v-card-chin
      v-btn(color='primary', @click='save')
        v-icon(left) chevron_right
        span Apply Configuration
      v-spacer
      v-btn(icon, @click='refresh')
        v-icon.grey--text refresh

</template>

<script>
export default {
  data() {
    return {
      editors: [
        { text: 'Markdown (default)', value: 'code' }
      ],
      selectedEditor: 'code'
    }
  },
  methods: {
    save() {},
    refresh() {}
  }
}
</script>

<style lang='scss'>

</style>
