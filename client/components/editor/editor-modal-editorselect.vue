<template lang='pug'>
  v-dialog(v-model='isShown', persistent, max-width='700', no-click-animation)
    v-btn(fab, fixed, bottom, right, color='grey darken-3', dark, @click='goBack', style='width: 50px;'): v-icon mdi-undo-variant
    v-card.radius-7(color='blue darken-3', dark)
      v-card-text.text-center.py-4
        .subtitle-1.white--text {{$t('editor:select.title')}}
        v-container(grid-list-lg, fluid)
          v-layout(row, wrap, justify-center)
            v-flex(xs6)
              v-card.radius-7.animated.fadeInUp.wait-p1s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("markdown")')
                  img(src='/_assets/svg/editor-icon-markdown.svg', alt='Markdown', style='width: 36px;')
                  .body-2.primary--text.mt-2 Markdown
                  .caption.grey--text Plain Text Formatting
            v-flex(xs6)
              v-card.radius-7.animated.fadeInUp.wait-p2s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("ckeditor")')
                  img(src='/_assets/svg/editor-icon-ckeditor.svg', alt='Visual Editor', style='width: 36px;')
                  .body-2.mt-2.primary--text Visual Editor
                  .caption.grey--text Rich-text WYSIWYG
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p3s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("asciidoc")')
                  img(src='/_assets/svg/editor-icon-asciidoc.svg', alt='AsciiDoc', style='width: 36px;')
                  .body-2.primary--text.mt-2 AsciiDoc
                  .caption.grey--text Plain Text Formatting
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p4s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='selectEditor("code")')
                  img(src='/_assets/svg/editor-icon-code.svg', alt='Code', style='width: 36px;')
                  .body-2.primary--text.mt-2 Code
                  .caption.grey--text Raw HTML
            v-flex(xs4)
              v-card.radius-7.animated.fadeInUp.wait-p5s(
                hover
                light
                ripple
                )
                v-card-text.text-center(@click='fromTemplate')
                  img(src='/_assets/svg/icon-cube.svg', alt='From Template', style='width: 42px; opacity: .5;')
                  .body-2.mt-1.teal--text From Template
                  .caption.grey--text Use an existing page...

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
