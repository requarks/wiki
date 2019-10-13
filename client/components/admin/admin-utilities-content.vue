<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.contentTitle') }}
    v-card-text
      .subtitle-1.pb-3.primary--text Rebuild Page Tree
      .body-2 The virtual structure of your wiki is automatically inferred from all page paths. You can trigger a full rebuild of the tree if some virtual folders are missing or not valid anymore.
      v-btn(outlined, color='primary', @click='rebuildTree', :disabled='loading').ml-0.mt-3
        v-icon(left) mdi-gesture-double-tap
        span Proceed
      v-divider.my-5
      .subtitle-1.pb-3.pl-0.primary--text Migrate all pages to target locale
      .body-2 If you created content before selecting a different locale and activating the namespacing capabilities, you may want to transfer all content to the base locale.
      .body-2.red--text: strong This operation is destructive and cannot be reversed! Make sure you have proper backups!
      v-toolbar.radius-7.mt-5(flat, :color='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-4`', height='80')
        v-select(
          label='Source Locale'
          outlined
          hide-details
          :items='locales'
          item-text='name'
          item-value='code'
          v-model='sourceLocale'
        )
        v-icon.mx-3(large) mdi-chevron-right-box-outline
        v-select(
          label='Target Locale'
          outlined
          hide-details
          :items='locales'
          item-text='name'
          item-value='code'
          v-model='targetLocale'
        )
      .body-2.mt-5 Pages that are already in the target locale will not be touched. If a page already exists at the target, the source page will not be modified as it would create a conflict. If you want to overwrite the target page, you must first delete it.
      v-btn(outlined, color='primary', @click='migrateToLocale', :disabled='loading').ml-0.mt-3
        v-icon(left) mdi-gesture-double-tap
        span Proceed
</template>

<script>
import _ from 'lodash'
import utilityContentMigrateLocaleMutation from 'gql/admin/utilities/utilities-mutation-content-migratelocale.gql'
import utilityContentRebuildTreeMutation from 'gql/admin/utilities/utilities-mutation-content-rebuildtree.gql'

/* global siteLangs, siteConfig */

export default {
  data: () => {
    return {
      loading: false,
      sourceLocale: '',
      targetLocale: ''
    }
  },
  computed: {
    currentLocale () {
      return siteConfig.lang
    },
    locales () {
      return siteLangs
    }
  },
  methods: {
    async rebuildTree () {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-content-rebuildtree')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityContentRebuildTreeMutation
        })
        const resp = _.get(respRaw, 'data.pages.rebuildTree.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Page Tree rebuilt successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-content-rebuildtree')
      this.loading = false
    },
    async migrateToLocale () {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-content-migratelocale')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityContentMigrateLocaleMutation,
          variables: {
            sourceLocale: this.sourceLocale,
            targetLocale: this.targetLocale
          }
        })
        const resp = _.get(respRaw, 'data.pages.migrateToLocale.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: `Migrated ${_.get(respRaw, 'data.pages.migrateToLocale.count', 0)} page(s) to target locale successfully.`,
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
