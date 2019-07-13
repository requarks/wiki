<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subheading {{ $t('admin:utilities.cacheTitle') }}
    v-card-text
      v-subheader.pl-0.primary--text Flush Pages and Assets Cache
      .body-1 Pages and Assets are cached to disk for better performance. You can flush the cache to force all content to be fetched from the DB again.
      v-btn(outline, color='primary', @click='flushCache', :disabled='loading').ml-0.mt-3
        v-icon(left) build
        span Proceed
      v-divider.my-3
      v-subheader.pl-0.primary--text Flush Temporary Uploads
      .body-1 New uploads are temporarily saved to disk while they are being processed. They are automatically deleted after processing, but you can force an immediate cleanup using this tool.
      .body-1.red--text Note that performing this action while an upload is in progress can result in a failed upload.
      v-btn(outline, color='primary', @click='flushUploads', :disabled='loading').ml-0.mt-3
        v-icon(left) build
        span Proceed
</template>

<script>
import _ from 'lodash'
import utilityCacheFlushCacheMutation from 'gql/admin/utilities/utilities-mutation-cache-flushcache.gql'
import utilityCacheFlushUploadsMutation from 'gql/admin/utilities/utilities-mutation-cache-flushuploads.gql'

export default {
  data() {
    return {
      loading: false
    }
  },
  methods: {
    async flushCache() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-cache-flushCache')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityCacheFlushCacheMutation
        })
        const resp = _.get(respRaw, 'data.pages.flushCache.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Cache flushed successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-cache-flushCache')
      this.loading = false
    },
    async flushUploads() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-cache-flushUploads')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityCacheFlushUploadsMutation
        })
        const resp = _.get(respRaw, 'data.assets.flushTempUploads.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Temporary Uploads flushed successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-cache-flushUploads')
      this.loading = false
    }
  }
}
</script>

<style lang='scss'>

</style>
