<template lang='pug'>
  v-dialog(v-model='isShown', max-width='550', persistent)
    v-card.wiki-form
      .dialog-header.is-short.is-red
        v-icon.mr-2(color='white') highlight_off
        span Delete Page
      v-card-text
        .body-2 Are you sure you want to delete page #[span.red--text.text--darken-2 {{pageTitle}}]?
        .caption The page can be restored from the administration area.
        v-chip.mt-3.ml-0.mr-1(label, color='red lighten-4', disabled, small)
          .caption.red--text.text--darken-2 {{pageLocale.toUpperCase()}}
        v-chip.mt-3.mx-0(label, color='red lighten-5', disabled, small)
          span.red--text.text--darken-2 /{{pagePath}}
      v-card-chin
        v-spacer
        v-btn(flat, @click='discard', :disabled='loading') Cancel
        v-btn(color='red darken-2', @click='deletePage', :loading='loading').white--text Delete
</template>

<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      loading: false
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
    async deletePage() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-delete')
      this.$nextTick(async () => {
        try {
          const resp = await this.$apollo.mutate({
            mutation: deletePageMutation,
            variables: {
              id: this.pageId
            }
          })
          if (_.get(resp, 'data.pages.delete.responseResult.succeeded', false)) {
            this.isShown = false
            _.delay(() => {
              document.body.classList.add('page-deleted')
              _.delay(() => {
                window.location.assign('/')
              }, 1200)
            }, 400)
          } else {
            throw new Error(_.get(resp, 'data.pages.delete.responseResult.message', 'An unexpected error occured.'))
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
