<template lang='pug'>
  v-dialog(v-model='isShown', persistent, max-width='700')
    v-card.radius-7(color='blue darken-3', dark)
      v-card-text.text-xs-center.py-4
        .subheading {{$t('editor:select.title')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs4)
              v-card.radius-7.grey(
                hover
                light
                ripple
                )
                v-card-text.text-xs-center(@click='selectEditor("api")')
                  img(src='/svg/icon-rest-api.svg', alt='API', style='width: 36px;')
                  .body-2.mt-2.grey--text.text--darken-2 API Docs
                  .caption.grey--text.text--darken-1 REST / GraphQL
            v-flex(xs4)
              v-card.radius-7.grey(
                hover
                light
                ripple
                )
                v-card-text.text-xs-center(@click='selectEditor("code")')
                  img(src='/svg/icon-source-code.svg', alt='Code', style='width: 36px;')
                  .body-2.mt-2.grey--text.text--darken-2 Code
                  .caption.grey--text.text--darken-1 Raw HTML
            v-flex(xs4)
              v-card.radius-7(
                hover
                light
                ripple
                )
                v-card-text.text-xs-center(@click='selectEditor("markdown")')
                  img(src='/svg/icon-markdown.svg', alt='Markdown', style='width: 36px;')
                  .body-2.mt-2 Markdown
                  .caption.grey--text Default
            v-flex(xs4)
              v-card.radius-7.grey(
                hover
                light
                ripple
                )
                v-card-text.text-xs-center(@click='selectEditor("tabular")')
                  img(src='/svg/icon-table.svg', alt='Tabular', style='width: 36px;')
                  .body-2.grey--text.mt-2.text--darken-2 Tabular
                  .caption.grey--text.text--darken-1 Excel-like
            v-flex(xs4)
              v-card.radius-7.grey(
                hover
                light
                ripple
                )
                v-card-text.text-xs-center(@click='selectEditor("wysiwyg")')
                  img(src='/svg/icon-open-in-browser.svg', alt='Visual Builder', style='width: 36px;')
                  .body-2.mt-2.grey--text.text--darken-2 Visual Builder
                  .caption.grey--text.text--darken-1 Drag-n-drop
            v-flex(xs4)
              v-card.radius-7.grey(
                hover
                light
                ripple
                )
                v-card-text.text-xs-center(@click='selectEditor("wikitext")')
                  img(src='/svg/icon-news.svg', alt='WikiText', style='width: 36px;')
                  .body-2.grey--text.mt-2.text--darken-2 WikiText
                  .caption.grey--text.text--darken-1 MediaWiki Format
        .caption.blue--text.text--lighten-2 {{$t('editor:select.cannotChange')}}
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'

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
    },
    currentEditor: sync('editor/editor')
  },
  methods: {
    selectEditor(name) {
      this.currentEditor = `editor${_.startCase(name)}`
      this.isShown = false
    }
  }
}
</script>

<style lang='scss'>

</style>
