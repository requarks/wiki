<template lang='pug'>
  v-dialog(v-model='isShown', persistent, max-width='700')
    v-card.radius-7(color='blue darken-3', dark)
      v-card-text.text-center.py-4
        .subtitle-1.white--text {{$t('editor:select.title')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-rest-api.svg', alt='API', style='width: 36px;')
                      .body-2.mt-2.grey--text.text--darken-2 API Docs
                      .caption.grey--text.text--darken-1 REST / GraphQL
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-source-code.svg', alt='Code', style='width: 36px;')
                      .body-2.mt-2.grey--text.text--darken-2 Code
                      .caption.grey--text.text--darken-1 Raw HTML
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
            v-flex(xs4)
              v-card.radius-7(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("markdown")')
                  img(src='/svg/icon-markdown.svg', alt='Markdown', style='width: 36px;')
                  .primary--text.body-2.mt-2 Markdown
                  .caption.grey--text Default
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-table.svg', alt='Tabular', style='width: 36px;')
                      .body-2.grey--text.mt-2.text--darken-2 Tabular
                      .caption.grey--text.text--darken-1 Excel-like
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
            //- v-flex(xs4)
            //-   v-card.radius-7.grey(
            //-     hover
            //-     light
            //-     ripple
            //-     disabled
            //-     )
            //-     v-card-text.text-center(@click='selectEditor("wysiwyg")')
            //-       img(src='/svg/icon-open-in-browser.svg', alt='Visual Builder', style='width: 36px;')
            //-       .body-2.mt-2.grey--text.text--darken-2 Visual Builder
            //-       .caption.grey--text.text--darken-1 Drag-n-drop
            v-flex(xs4)
              v-card.radius-7(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("ckeditor")')
                  img(src='/svg/icon-open-in-browser.svg', alt='Visual Editor', style='width: 36px;')
                  .body-2.mt-2.primary--text Visual Editor
                  .caption.grey--text Rich-text WYSIWYG
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-news.svg', alt='WikiText', style='width: 36px;')
                      .body-2.grey--text.mt-2.text--darken-2 WikiText
                      .caption.grey--text.text--darken-1 MediaWiki Format
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
        .caption.blue--text.text--lighten-2 {{$t('editor:select.cannotChange')}}

    v-card.radius-7.mt-3(color='teal darken-3', dark)
      v-card-text.text-center.py-4
        .subtitle-1.white--text {{$t('editor:select.customView')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-cube.svg', alt='From Template', style='width: 42px;')
                      .body-2.mt-1.grey--text.text--darken-2 From Template
                      .caption.grey--text.text--darken-1 Use an existing page / tree
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='teal'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-hierarchy.svg', alt='Code', style='width: 42px;')
                      .body-2.mt-1.grey--text.text--darken-2 Tree View
                      .caption.grey--text.text--darken-1 List children pages
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='teal'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.grey(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-sewing-patch.svg', alt='Code', style='width: 42px;')
                      .body-2.mt-1.grey--text.text--darken-2 Embed
                      .caption.grey--text.text--darken-1 Include external pages
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='teal'
                        opacity='.8'
                        )
                        .body-2 Coming Soon
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
