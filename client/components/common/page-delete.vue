<template lang='pug'>
  v-dialog(
    v-model='isShown'
    max-width='700'
    persistent
    :overlay-color='colors.white'
    overlay-opacity='.7'
  )
    v-card
      .critical-bar
      .dialog-header.is-short
        v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
        span {{$t('common:page.delete')}}
        v-icon.close-btn(
          @click='discard',
          :class="$vuetify.theme.dark ? 'white--text' : 'black--text'",
          style="position: absolute; top: 16px; right: 16px; cursor: pointer;"
        ) mdi-close
      v-card-text.pt-5
        i18next.body-1(path='common:page.deleteTitle', tag='div')
          span(place='title') {{pageTitle}}
        .caption {{$t('common:page.deleteSubtitle')}}
      v-card-actions.button-bar
        v-spacer
        v-btn.cancel-btn(text, @click='discard', :disabled='loading')
          span Cancel
        template(v-if='!hasChildren')
          v-btn.delete-notify-btn.px-4(
            @click='deletePage(true)',
            :loading='loading'
          )
            span.delete-notify-icon
              v-icon.red--text mdi-exclamation
            span.red--text Delete & Notify
          v-btn.px-4.delete-btn(
            @click='deletePage(false)',
            :loading='loading'
          )
            span.delete-notify-icon-dark
              v-icon.black--text mdi-exclamation
            span.black--text {{$t('common:actions.delete')}}
        template(v-else)
          .body-2.red--text.text--darken-2(style='margin-top: 12px;')
            v-icon(left, color='red') mdi-alert
            | {{ PAGE_DELETE_HAS_SUBPAGES_MSG }}
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'
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
      colors
    }
  },
  computed: {
    PAGE_DELETE_HAS_SUBPAGES_MSG() {
      return require('@/messages').PAGE_DELETE_HAS_SUBPAGES_MSG
    },
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    pageTitle: get('page/title'),
    pagePath: get('page/path'),
    pageLocale: get('page/locale'),
    pageId: get('page/id'),
    hasChildren: get('page/hasChildren')
  },
  watch: {
    isShown(newValue) {
      if (newValue) {
        document.body.classList.add('page-deleted-pending')
      } else {
        document.body.classList.remove('page-deleted-pending')
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
      this.$store.commit('loadingStart', 'page-delete')
      this.$nextTick(async () => {
        try {
          const resp = await this.$apollo.mutate({
            mutation: deletePageMutation,
            variables: {
              id: this.pageId,
              notifyFollowers
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
        this.$store.commit('loadingStop', 'page-delete')
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
    background-color: mc('neutral', '900');
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
.critical-bar {
  height: 6px;
  width: 100%;
  background-color: #d32f2f;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
}
.dialog-header.is-short {
  background-color: #fff !important;
  color: #232323 !important;
  position: relative;
}
.theme--dark .dialog-header.is-short {
  background-color: #000 !important;
  color: #fff !important;
}
.v-card-text {
  color: #232323 !important;
}
.theme--dark .v-card__text {
  color: #fff !important;
}
.button-bar {
  padding: 16px 24px;
  display: flex;
  gap: 20px;
}
.theme--dark .button-bar {
  background: #000;
}
.cancel-btn {
  border: 1.5px solid #000 !important;
  background: #fff !important;
  color: #232323 !important;
  border-radius: 8px;
  font-weight: 500;
}
.theme--dark .cancel-btn {
  border: 1.5px solid #fff !important;
  background: #000 !important;
  color: #fff !important;
}
.delete-notify-btn {
  border: 1.5px solid #d32f2f !important;
  color: #d32f2f !important;
  border-radius: 8px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff !important;
}
.theme--dark .delete-notify-btn {
  background: #000 !important;
}
.delete-notify-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid #d32f2f;
  margin-right: 8px;
  background: #fff;
}
.theme--dark .delete-notify-icon {
  background: #000;
}
.delete-notify-icon .v-icon {
  color: #d32f2f !important;
  font-size: 18px;
}
.delete-btn {
  background: #d32f2f !important;
  border-radius: 8px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}
.delete-btn .delete-notify-icon-dark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #d32f2f;
  border: 1.5px solid #000;
  margin-right: 8px;
}
.delete-btn .v-icon.black--text {
  color: #000 !important;
  font-size: 18px;
}
.delete-btn .black--text {
  color: #000 !important;
}
.delete-btn .white--text {
  color: #fff !important;
}
.close-btn {
  background: transparent !important;
  border: none !important;
  font-size: 24px;
}
.white--text {
  color: #fff !important;
}
.black--text {
  color: #232323 !important;
}
</style>
