<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Editor
        .subheading.grey--text Configure the content editor
      v-tabs(color='grey lighten-4', fixed-tabs, slider-color='primary', show-arrows)
        v-tab(key='settings'): v-icon settings
        v-tab(key='code') Markdown

        v-tab-item(key='settings', :transition='false', :reverse-transition='false')
          v-card.pa-3
            v-form
              v-radio-group(v-model='selectedEditor')
                v-radio(v-for='(editor, n) in editors', :key='n', :label='editor.text', :value='editor.value', color='primary')
              v-divider
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Set Editor
              v-btn(icon)
                v-icon.grey--text refresh
        v-tab-item(key='code', :transition='false', :reverse-transition='false')
          v-card.pa-3
            v-form
              v-subheader Editor Configuration
              .body-1 This editor has no configuration options you can modify.

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
  }
}
</script>

<style lang='scss'>

</style>
