<template lang='pug'>
  v-dialog(
    v-model='isShown'
    max-width='550'
    persistent
    :overlay-color='colors.alert.error'
    overlay-opacity='.7'
    )
    v-card
      .dialog-header.is-short(:style='"background-color: " + colors.alert.error')
        v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
        span {{$t('common:page.delete')}}
      v-card-text.pt-5
        i18next.body-1(path='common:page.deleteTitle', tag='div')
          span(place='title' :style='"color: " + colors.alert.error') {{pageTitle}}
        .caption {{$t('common:page.deleteSubtitle')}}
        v-chip.mt-3.ml-0.mr-1(label, color='red lighten-4', small)
          .caption(:style='"color: " + colors.red[5]') {{pageLocale.toUpperCase()}}
        v-chip.mt-3.mx-0(label, color='red lighten-5', small)
          span(:style='"color: " + colors.red[5]') /{{pagePath}}
      v-card-chin
        v-spacer
        v-btn(text, @click='discard', :disabled='loading') {{$t('common:actions.cancel')}}
        v-btn.px-4(:color='colors.alert.error', @click='deletePage(false)', :loading='loading').white--text {{$t('common:actions.delete')}}
        v-btn.px-4(:color='colors.alert.error', @click='deletePage(true)', :loading='loading').white--text Delete & Notify
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'
import colors from '@/themes/default/js/extended-color-scheme'

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
    pageId: get('page/id')
  },
  watch: {
    isShown(newValue, oldValue) {
      if (newValue) {
        document.body.classList.add('page-deleted-pending')
      }
    }
  },
  methods: {
    discard() {
      document.body.classList.remove('page-deleted-pending')
      this.isShown = false
    },
    async deletePage(notifyFollowers = false) {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-delete')
      this.$nextTick(async () => {
        try {
          const resp = await this.$apollo.mutate({
            mutation: deletePageMutation,
            variables: {
              id: this.pageId,
              notifyFollowers: notifyFollowers
            }
          })
          if (_.get(resp, 'data.pages.delete.responseResult.succeeded', false)) {
            this.isShown = false
            _.delay(() => {
              document.body.classList.add('page-deleted')
              _.delay(() => {
                window.location.assign(`/${this.$store.get('page/sitePath')}`)
              }, 1200)
            }, 400)
          } else {
            throw new Error(_.get(resp, 'data.pages.delete.responseResult.message', this.$t('common:error.unexpected')))
          }
        } catch (err) {
          this.$store.commit('pushGraphError', err)
        }
        this.$store.commit(`loadingStop`, 'page-delete')
        this.loading = false
      })
    }
  }
}
</script>

<style lang='scss'>
  body.page-deleted-pending {
    perspective: 50vw;
    height: 100vh;
    overflow: hidden;

    .application {
      background-color: mc('grey', '900');
    }
    .application--wrap {
      transform-style: preserve-3d;
      transform: translateZ(-5vw) rotateX(2deg);
      border-radius: 7px;
      overflow: hidden;
    }
  }
  body.page-deleted {
    perspective: 50vw;

    .application--wrap {
      transform-style: preserve-3d;
      transform: translateZ(-1000vw) rotateX(60deg);
      opacity: 0;
    }
  }
</style>
