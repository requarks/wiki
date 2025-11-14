<template lang='pug'>
  v-dialog(
    v-model='isShown'
    max-width='550'
    persistent
    overlay-color='blue-grey darken-4'
    overlay-opacity='.7'
    )
    v-card
      .dialog-header.is-short(:style='`background-color: ${colors.blue[500]} !important;`')
        v-icon.mr-2(color='white') mdi-lightning-bolt
        span(:style='`color: ${colors.textLight.inverse};`') {{$t('common:page.convert')}}
      v-card-text.pt-5
        i18next.body-2(path='common:page.convertTitle', tag='div', :style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`')
          span(:style='`color: ${$vuetify.theme.dark ? colors.textDark.secondary : colors.textLight.secondary};`', place='title') {{pageTitle}}
        v-select.mt-5(
          :items=`[
            { value: 'markdown', text: 'Markdown' },
            { value: 'ckeditor', text: 'Visual Editor' },
            { value: 'code', text: 'Raw HTML' }
          ]`
          outlined
          dense
          hide-details
          v-model='newEditor'
        )
        .caption.mt-5(:style='`color: ${$vuetify.theme.dark ? colors.textDark.tertiary : colors.textLight.tertiary};`') {{$t('common:page.convertSubtitle')}}
      v-card-chin
        v-spacer
        v-btn.btn-rounded(
          outlined
          rounded
          :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
          @click='discard'
          :disabled='loading'
          ) {{$t('common:actions.cancel')}}
        v-btn.px-4.btn-rounded(
          rounded
          dark
          :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
          @click='convertPage'
          :loading='loading'
          )
          span.text-none CONVERT
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import colors from '@/themes/default/js/color-scheme'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      loading: false,
      newEditor: '',
      colors: colors
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    pageTitle: get('page/title'),
    pagePath: get('page/path'),
    pageLocale: get('page/locale'),
    pageId: get('page/id'),
    pageEditor: get('page/editor'),
    sitePath: get('page/sitePath')
  },
  mounted () {
    this.newEditor = this.pageEditor
  },
  methods: {
    discard() {
      this.isShown = false
    },
    async convertPage() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-convert')
      this.$nextTick(async () => {
        try {
          const resp = await this.$apollo.mutate({
            mutation: gql`
              mutation (
                $id: Int!
                $editor: String!
                ) {
                  pages {
                    convert(
                      id: $id
                      editor: $editor
                    ) {
                      responseResult {
                        succeeded
                        errorCode
                        slug
                        message
                      }
                    }
                  }
              }
            `,
            variables: {
              id: this.pageId,
              editor: this.newEditor
            }
          })
          if (_.get(resp, 'data.pages.convert.responseResult.succeeded', false)) {
            this.isShown = false
            window.location.assign(`/e/${this.sitePath}/${this.pageLocale}/${this.pagePath}`)
          } else {
            throw new Error(_.get(resp, 'data.pages.convert.responseResult.message', this.$t('common:error.unexpected')))
          }
        } catch (err) {
          this.$store.commit('pushGraphError', err)
        }
        this.$store.commit(`loadingStop`, 'page-convert')
        this.loading = false
      })
    }
  }
}
</script>

<style lang='scss'>
.v-btn.btn-rounded {
  border-radius: 20px;
}
</style>
