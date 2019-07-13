<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subheading {{ $t('admin:utilities.contentTitle') }}
    v-card-text
      v-subheader.pl-0.primary--text Migrate all pages to base language
      .body-1 If you created content before selecting a different locale and activating the namespacing capabilities, you may want to transfer all content to the base locale.
      .body-1.red--text: strong This operation is destructive and cannot be reversed! Make sure you have proper backups!
      .body-1.mt-3 Based on your current configuration, all pages will be migrated to the locale #[v-chip(label, small): strong {{currentLocale.toUpperCase()}}]
      .body-1.mt-3 Pages that are already in the target locale will not be touched. If a page already exists at the target, the source page will not be modified as it would create a conflict. If you want to overwrite the target content, you must first delete that page.
      v-btn(outline, color='primary', @click='migrateToLocale', :disabled='loading').ml-0.mt-3
        v-icon(left) build
        span Proceed
</template>

<script>
import _ from 'lodash'
import utilityContentMigrateLocaleMutation from 'gql/admin/utilities/utilities-mutation-content-migratelocale.gql'

/* global siteLang */

export default {
  data: () => {
    return {
      loading: false
    }
  },
  computed: {
    currentLocale() {
      return siteConfig.lang
    }
  },
  methods: {
    async migrateToLocale() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-content-migratelocale')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityContentMigrateLocaleMutation,
          variables: {
            targetLocale: siteConfig.lang
          }
        })
        const resp = _.get(respRaw, 'data.pages.migrateToLocale.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Migrated all content to target locale successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-content-migratelocale')
      this.loading = false
    }
  }
}
</script>

<style lang='scss'>

</style>
