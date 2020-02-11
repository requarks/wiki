<template lang='pug'>
  v-dialog(v-model='isShown', persistent, max-width='700', no-click-animation)
    v-btn(fab, fixed, bottom, right, color='grey darken-3', dark, @click='goBack', style='width: 50px;'): v-icon mdi-undo-variant
    v-card.radius-7(color='blue darken-3', dark)
      v-card-text.text-center.py-4
        .subtitle-1.white--text {{$t('editor:select.title')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.primary.animated.fadeInUp(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/editor-icon-api.svg', alt='API', style='width: 36px; opacity: .5;')
                      .body-2.blue--text.mt-2.text--lighten-2 API Docs
                      .caption.blue--text.text--lighten-1 REST / GraphQL
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2.mt-7 Coming Soon
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.primary.animated.fadeInUp.wait-p1s(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/editor-icon-wikitext.svg', alt='WikiText', style='width: 36px; opacity: .5;')
                      .body-2.blue--text.mt-2.text--lighten-2 Blog
                      .caption.blue--text.text--lighten-1 Timeline of Posts
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2.mt-7 Coming Soon
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p2s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("code")')
                  img(src='/svg/editor-icon-code.svg', alt='Code', style='width: 36px;')
                  .body-2.primary--text.mt-2 Code
                  .caption.grey--text Raw HTML
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p1s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("markdown")')
                  img(src='/svg/editor-icon-markdown.svg', alt='Markdown', style='width: 36px;')
                  .body-2.primary--text.mt-2 Markdown
                  .caption.grey--text Plain Text Formatting
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.primary.animated.fadeInUp.wait-p2s(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/editor-icon-tabular.svg', alt='Tabular', style='width: 36px; opacity: .5;')
                      .body-2.blue--text.mt-2.text--lighten-2 Tabular
                      .caption.blue--text.text--lighten-1 Excel-like
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='primary'
                        opacity='.8'
                        )
                        .body-2.mt-7 Coming Soon
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p3s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("ckeditor")')
                  img(src='/svg/editor-icon-ckeditor.svg', alt='Visual Editor', style='width: 36px;')
                  .body-2.mt-2.primary--text Visual Editor
                  .caption.grey--text Rich-text WYSIWYG
        .caption.blue--text.text--lighten-2 {{$t('editor:select.cannotChange')}}

    v-card.radius-7.mt-2(color='teal darken-3', dark)
      v-card-text.text-center.py-4
        .subtitle-1.white--text {{$t('editor:select.customView')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.teal.animated.fadeInUp(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-cube.svg', alt='From Template', style='width: 42px; opacity: .5;')
                      .body-2.mt-1.teal--text.text--lighten-2 From Template
                      .caption.teal--text.text--lighten-1 Use an existing page / tree
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='teal'
                        opacity='.8'
                        )
                        .body-2.mt-7 Coming Soon
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.teal.animated.fadeInUp.wait-p1s(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-tree-structure.svg', alt='Tree View', style='width: 42px; opacity: .5;')
                      .body-2.mt-1.teal--text.text--lighten-2 Tree View
                      .caption.teal--text.text--lighten-1 List children pages
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='teal'
                        opacity='.8'
                        )
                        .body-2.mt-7 Coming Soon
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.teal.animated.fadeInUp.wait-p2s(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/svg/icon-sewing-patch.svg', alt='Code', style='width: 42px; opacity: .5;')
                      .body-2.mt-1.teal--text.text--lighten-2 Embed
                      .caption.teal--text.text--lighten-1 Include external pages
                    v-fade-transition
                      v-overlay(
                        v-if='hover'
                        absolute
                        color='teal'
                        opacity='.8'
                        )
                        .body-2.mt-7 Coming Soon
    v-hover
      template(v-slot:default='{ hover }')
        v-card.radius-7.mt-2(color='indigo darken-3', dark)
          v-toolbar(dense, flat, color='light-green darken-3')
            v-spacer
            .caption.mr-1 or convert from
            v-btn.mx-1.animated.fadeInUp(depressed, color='light-green darken-2', @click='', disabled)
              v-icon(left) mdi-alpha-a-circle
              .body-2.text-none AsciiDoc
            v-btn.mx-1.animated.fadeInUp.wait-p1s(depressed, color='light-green darken-2', @click='', disabled)
              v-icon(left) mdi-alpha-c-circle
              .body-2.text-none CREOLE
            v-btn.mx-1.animated.fadeInUp.wait-p2s(depressed, color='light-green darken-2', @click='', disabled)
              v-icon(left) mdi-alpha-t-circle
              .body-2.text-none Textile
            v-btn.mx-1.animated.fadeInUp.wait-p3s(depressed, color='light-green darken-2', @click='', disabled)
              v-icon(left) mdi-alpha-w-circle
              .body-2.text-none WikiText
            v-spacer
          v-fade-transition
            v-overlay(
              v-if='hover'
              absolute
              color='light-green darken-3'
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
    },
    goBack() {
      window.history.go(-1)
    }
  }
}
</script>

<style lang='scss'>

</style>
