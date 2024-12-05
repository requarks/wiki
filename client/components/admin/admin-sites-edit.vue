<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size=80) mdi-sitemap
          .admin-header-title
            .headline.blue--text.text--darken-2 Edit Site
            .subtitle-1.grey--text {{site.name}}
          v-spacer
          v-btn(color='grey', icon, outlined, to='/sites')
            v-icon mdi-arrow-left
          v-dialog(v-model='deleteSiteDialog', max-width='500')
            template(v-slot:activator='{ on }')
              v-btn.ml-3(color='red', icon, outlined, v-on='on')
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-red Delete Site?
              v-card-text.pa-4 Are you sure you want to delete site #[strong {{ site.name }}]?
              v-card-actions
                v-spacer
                v-btn(text, @click='deleteSiteDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteSite') Delete
          v-btn.ml-3(color='success', large, depressed, @click='updateSite')
            v-icon(left) mdi-check
            span Update Site
        v-card.mt-3
          v-card(flat)

                v-card-text
                  v-text-field(
                    outlined
                    v-model='site.name'
                    label='Site Name'
                    hide-details
                    prepend-icon='mdi-account-group'
                    :counter='255'
                    style='max-width: 600px; margin-left: 15px; padding-bottom: 10px;'
                  )
                  v-card-text
                    v-text-field(
                      outlined
                      v-model='site.path'
                      label='Path'
                      persistent-hint
                      prepend-icon='mdi-arrow-top-left-thick'
                      style='max-width: 600px;'
                      :counter='255'
                      :disabled='true'
                    )

                  v-switch.mt-0.ml-1(
                    inset
                    :label='$t(`Enable Site`)'
                    color='primary'
                    v-model='site.isEnabled'
                    )

</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import siteQuery from 'gql/admin/sites/sites-query-by-id.gql'
import deleteSiteMutation from 'gql/admin/sites/sites-mutation-delete.gql'
import updateSiteMutation from 'gql/admin/sites/sites-mutation-update.gql'

/* global siteConfig */

export default {
  data() {
    return {
      site: {},
      loading: false,
      deleteSiteDialog: false,
      currentLang: siteConfig.lang,
      routeParam: this.$route.params.id || ''
    }
  },
  mounted() {},
  methods: {
    async updateSite() {
      try {
        await this.$apollo.mutate({
          mutation: updateSiteMutation,
          variables: {
            id: this.site.id,
            name: this.site.name,
            isEnabled: this.site.isEnabled
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-sites-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Site changes have been saved.`,
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async deleteSite() {
      this.deleteSiteDialog = false
      try {
        const resp = await this.$apollo.mutate({
          mutation: deleteSiteMutation,
          variables: {
            id: this.site.id
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Site ${this.site.name} has been deleted.`,
          icon: 'delete'
        })
        this.$router.replace('/sites')
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    async refresh() {
      return this.$apollo.queries.site.refetch()
    }
  },
  apollo: {
    site: {
      query: siteQuery,
      variables() {
        return {
          id: this.routeParam || null
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => { return _.cloneDeep(data.siteById) },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-sites-refresh')
      },
      skip() {
        return !this.routeParam
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
