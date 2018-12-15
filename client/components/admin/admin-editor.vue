<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-web-design.svg', alt='Editor', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Editor
            .subheading.grey--text Configure the content editor
          v-spacer
          v-btn(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn(color='primary', @click='save', depressed, large)
            v-icon(left) chevron_right
            span Apply Configuration

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark)
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
              v-card.wiki-form.pa-3(flat, tile)
                v-form
                  v-subheader Editor Configuration
                  .body-1.ml-3 This editor has no configuration options you can modify.
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
