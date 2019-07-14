<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subheading {{ $t('admin:utilities.contentTitle') }}
    v-card-text
      v-subheader.pl-0.primary--text Migrate all pages to target locale
      .body-1 If you created content before selecting a different locale and activating the namespacing capabilities, you may want to transfer all content to the base locale.
      .body-1.red--text: strong This operation is destructive and cannot be reversed! Make sure you have proper backups!
      v-toolbar.radius-7.mt-3.wiki-form(flat, color='grey lighten-4', height='80')
        v-select(
          label='Source Locale'
          outline
          hide-details
          :items='locales'
          item-text='name'
          item-value='code'
          v-model='sourceLocale'
        )
        v-icon.mx-3(large) arrow_forward
        v-select(
          label='Target Locale'
          outline
          hide-details
          :items='locales'
          item-text='name'
          item-value='code'
          v-model='targetLocale'
        )
      .body-1.mt-3 Pages that are already in the target locale will not be touched. If a page already exists at the target, the source page will not be modified as it would create a conflict. If you want to overwrite the target page, you must first delete it.
      v-btn(outline, color='primary', @click='migrateToLocale', :disabled='loading').ml-0.mt-3
        v-icon(left) build
        span Proceed
</template>

<script>
import _ from 'lodash'
import utilityContentMigrateLocaleMutation from 'gql/admin/utilities/utilities-mutation-content-migratelocale.gql'

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
    async migrateToLocale() {
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
