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
                      img(src='/_assets/svg/editor-icon-api.svg', alt='API', style='width: 36px; opacity: .5;')
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
                      img(src='/_assets/svg/editor-icon-wikitext.svg', alt='WikiText', style='width: 36px; opacity: .5;')
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
                  img(src='/_assets/svg/editor-icon-code.svg', alt='Code', style='width: 36px;')
                  .body-2.primary--text.mt-2 Code
                  .caption.grey--text Raw HTML
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p1s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("markdown")')
                  img(src='/_assets/svg/editor-icon-markdown.svg', alt='Markdown', style='width: 36px;')
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
                      img(src='/_assets/svg/editor-icon-tabular.svg', alt='Tabular', style='width: 36px; opacity: .5;')
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
                  img(src='/_assets/svg/editor-icon-ckeditor.svg', alt='Visual Editor', style='width: 36px;')
                  .body-2.mt-2.primary--text Visual Editor
                  .caption.grey--text Rich-text WYSIWYG
        //- .caption.blue--text.text--lighten-2 {{$t('editor:select.cannotChange')}}

    v-card.radius-7.mt-2(color='teal darken-3', dark)
      v-card-text.text-center.py-4
        .subtitle-1.white--text {{$t('editor:select.customView')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.animated.fadeInUp(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='fromTemplate')
                      img(src='/_assets/svg/icon-cube.svg', alt='From Template', style='width: 42px; opacity: .5;')
                      .body-2.mt-1.teal--text From Template
                      .caption.grey--text Use an existing page...
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.teal.animated.fadeInUp.wait-p1s(
                    hover
                    light
                    ripple
                    )
                    //- v-card-text.text-center(@click='selectEditor("redirect")')
                    v-card-text.text-center(@click='')
                      img(src='/_assets/svg/icon-route.svg', alt='Redirection', style='width: 42px; opacity: .5;')
                      .body-2.mt-1.teal--text.text--lighten-2 Redirection
                      .caption.teal--text.text--lighten-1 Redirect the user to...
            v-flex(xs4)
              v-hover
                template(v-slot:default='{ hover }')
                  v-card.radius-7.teal.animated.fadeInUp.wait-p2s(
                    hover
                    light
                    ripple
                    )
                    v-card-text.text-center(@click='')
                      img(src='/_assets/svg/icon-sewing-patch.svg', alt='Code', style='width: 42px; opacity: .5;')
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

    page-selector(mode='select', v-model='templateDialogIsShown', :open-handler='fromTemplateHandle', :path='path', :locale='locale', must-exist)
</template>

<script>
import _ from 'lodash'
import { sync, get } from 'vuex-pathify'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      templateDialogIsShown: false
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    currentEditor: sync('editor/editor'),
    locale: get('page/locale'),
    path: get('page/path')
  },
  methods: {
    selectEditor (name) {
      this.currentEditor = `editor${_.startCase(name)}`
      this.isShown = false
    },
    goBack () {
      window.history.go(-1)
    },
    fromTemplate () {
      this.templateDialogIsShown = true
    },
    fromTemplateHandle ({ id }) {
      this.templateDialogIsShown = false
      this.isShown = false
      this.$nextTick(() => {
        window.location.assign(`/e/${this.locale}/${this.path}?from=${id}`)
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
