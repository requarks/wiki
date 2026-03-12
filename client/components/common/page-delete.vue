<template lang='pug'>
  v-dialog(
    v-model='internalShown'
    max-width='550'
    persistent
  )
    v-card(v-if='internalShown')
      .dialog-header.is-short(:style='`background-color: ${colors.red[450]} !important;`')
        v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
        span(:style='`color: ${colors.textLight.inverse};`') {{$t('common:page.delete')}}
      v-card-text.pt-5
        i18next.body-2(path='common:page.deleteTitle', tag='div', :style='`color: ${$vuetify.theme.dark ? colors.textDark.primary : colors.textLight.primary};`')
          span(:style='`color: ${$vuetify.theme.dark ? colors.textDark.secondary : colors.textLight.secondary};`', place='title') {{pageTitle}}
        .caption.mt-3(:style='`color: ${$vuetify.theme.dark ? colors.textDark.tertiary : colors.textLight.tertiary};`') {{$t('common:page.deleteSubtitle')}}
        template(v-if='hasChildren')
          v-alert.mt-4(
            type='error',
            outlined,
            dense
          )
            .body-2 {{ PAGE_DELETE_HAS_SUBPAGES_MSG }}
      v-card-chin
        v-spacer
        v-btn.btn-rounded(
          outlined
          rounded
          :color='$vuetify.theme.dark ? colors.surfaceDark.inverse : colors.surfaceLight.primarySapHeavy'
          @click='discard'
          :disabled='loading'
          ) {{$t('common:actions.cancel')}}
        template(v-if='!hasChildren')
          v-btn.btn-rounded(
            rounded
            dark
            :color='colors.red[300]'
            @click='deletePage(true)'
            :loading='loading'
          )
            v-icon(left, color='white') mdi-bell-alert
            span.text-none.text-uppercase(:style='`color: ${colors.textLight.inverse};`') {{$t('common:actions.deleteNotify')}}
          v-btn.btn-rounded(
            rounded
            dark
            :color='colors.red[450]'
            @click='deletePage(false)'
            :loading='loading'
          )
            v-icon(left, color='white') mdi-delete-forever
            span.text-none.text-uppercase(:style='`color: ${colors.textLight.inverse};`') {{$t('common:actions.delete')}}
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'
import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'
import childPagesQuery from '@/graph/common/common-pages-query-child-pages.gql'
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
      // internalShown controls the dialog visibility locally to avoid
      // opening the dialog before the server-side child check completes.
      internalShown: false,
      colors
    }
  },
  computed: {
    PAGE_DELETE_HAS_SUBPAGES_MSG() {
      return require('@/messages').PAGE_DELETE_HAS_SUBPAGES_MSG
    },
    // Expose the prop value as a read-only computed so we can watch it and
    // decide when to open the internal dialog state.
    isShown: function() { return this.value },
    pageTitle: get('page/title'),
    pagePath: get('page/path'),
    pageLocale: get('page/locale'),
    pageId: get('page/id'),
    hasChildren: get('page/hasChildren')
  },
  watch: {
    // Watch the incoming prop. When parent requests the dialog (prop -> true)
    // perform the server-side check and only open the internal dialog if
    // allowed. This prevents the v-dialog from briefly showing then closing.
    isShown: async function(newValue) {
      if (newValue) {
        try {
          const resp = await this.$apollo.query({
            query: childPagesQuery,
            variables: {
              pageId: this.pageId,
              locale: this.pageLocale,
              siteId: this.$store.get('page/siteId')
            },
            fetchPolicy: 'network-only'
          })
          const children = (resp && resp.data && resp.data.childPages) || []
          if (children && children.length > 0) {
            this.$store.commit('showNotification', {
              style: 'red',
              message: this.PAGE_DELETE_HAS_SUBPAGES_MSG,
              icon: 'warning',
              close: true
            })
            this.$emit('input', false)
            return
          }
          this.internalShown = true
          document.body.classList.add('page-deleted-pending')
        } catch (err) {
          this.$store.commit('pushGraphError', err)
          this.$store.commit('showNotification', {
            style: 'red',
            message: this.$t('common:error.unexpected'),
            icon: 'alert',
            close: true
          })
          this.$emit('input', false)
        }
      } else {
        this.internalShown = false
      }
    },

    // Keep parent prop in sync when internal dialog is closed locally.
    internalShown: function(newVal) {
      if (!newVal) {
        document.body.classList.remove('page-deleted-pending')
        this.$emit('input', false)
      }
    }
  },

  methods: {
    discard() {
      document.body.classList.remove('page-deleted-pending')
      this.internalShown = false
      this.$emit('input', false)
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
            this.internalShown = false
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
