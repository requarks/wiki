<template lang='pug'>
  v-dialog(
    v-model='isShown'
    max-width='550'
    persistent
    overlay-color='blue-grey darken-4'
    overlay-opacity='.7'
    )
    v-card
      .dialog-header.is-short.is-dark
        v-icon.mr-2(color='white') mdi-lightning-bolt
        span {{$t('common:page.convert')}}
      v-card-text.pt-5
        i18next.body-2(path='common:page.convertTitle', tag='div')
          span.blue-grey--text.text--darken-2(place='title') {{pageTitle}}
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
        .caption.mt-5 {{$t('common:page.convertSubtitle')}}
      v-card-chin
        v-spacer
        v-btn(text, @click='discard', :disabled='loading') {{$t('common:actions.cancel')}}
        v-btn.px-4(color='grey darken-3', @click='convertPage', :loading='loading').white--text {{$t('common:actions.convert')}}
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'

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
      newEditor: ''
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
    pageEditor: get('page/editor')
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
            window.location.assign(`/e/${this.pageLocale}/${this.pagePath}`)
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

</style>
