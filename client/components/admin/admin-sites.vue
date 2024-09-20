<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-people.svg', alt='Sites', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Sites
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s Manage Sites
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s.mx-3(color='grey', outlined, @click='refresh', icon)
            v-icon mdi-refresh
          v-dialog(v-model='newSiteDialog', max-width='500')
            template(v-slot:activator='{ on }')
              v-btn.animated.fadeInDown(color='primary', depressed, v-on='on', large)
                v-icon(left) mdi-plus
                span New Site
            v-card
              .dialog-header.is-short New Site
              v-card-text.pt-5
                v-text-field.md2(
                  outlined
                  prepend-icon='mdi-account-Site'
                  v-model='newSiteName'
                  label='Site Name'
                  counter='255'
                  @keyup.enter='createSite'
                  @keyup.esc='newSiteDialog = false'
                  ref='siteNameIpt'
                  )
              v-card-text.pt-5
                v-text-field.md2(
                  outlined
                  prepend-icon='mdi-account-Site'
                  v-model='newSitePath'
                  label='Path'
                  counter='255'
                  @keyup.enter='createSite'
                  @keyup.esc='newSiteDialog = false'
                  ref='siteNameIpt'
                  )
              v-card-chin
                v-spacer
                v-btn(text, @click='newSiteDialog = false') Cancel
                v-btn(color='primary', @click='createSite') Create
        v-card.mt-3.animated.fadeInUp
          v-data-table(
            :items='sites'
            :headers='headers'
            :search='search'
            :page.sync='pagination'
            :items-per-page='15'
            :loading='loading'
            @page-count='pageCount = $event'
            must-sort,
            hide-default-footer
          )
            template(slot='item', slot-scope='props')
              tr.is-clickable(:active='props.selected', @click='$router.push("/sites/" + props.item.id)')
                td {{ props.item.name }}
                td: strong {{ props.item.path }}
                td {{ props.item.userCount }}
                td {{ props.item.createdAt | moment('calendar') }}
                td
                  v-tooltip(left, v-if='props.item.isSystem')
                    template(v-slot:activator='{ on }')
                      v-icon(v-on='on') mdi-lock-outline
                    span System Site
            template(slot='no-data')
              v-alert.ma-3(icon='mdi-alert', :value='true', outline) No sites to display.
          .text-xs-center.py-2(v-if='pageCount > 1')
            v-pagination(v-model='pagination', :length='pageCount')
</template>

<script>
import _ from 'lodash'

import sitesQuery from 'gql/admin/sites/sites-query-list.gql'
import createSiteMutation from 'gql/admin/sites/sites-mutation-create.gql'

export default {
  data() {
    return {
      newSiteDialog: false,
      newSiteName: '',
      newSitePath: '',
      selectedSite: {},
      pagination: 1,
      pageCount: 0,
      sites: [],
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Path', value: 'path' },
        { text: 'Created', value: 'createdAt', width: 250 },
        { text: '', value: 'isSystem', width: 20, sortable: false }
      ],
      search: '',
      loading: false
    }
  },
  watch: {
    newSiteDialog(newValue, oldValue) {
      if (newValue) {
        this.$nextTick(() => {
          this.$refs.siteNameIpt.focus()
        })
      }
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.sites.refetch()
      this.$store.commit('showNotification', {
        message: 'Sites have been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async createSite() {
      if (_.trim(this.newSiteName).length < 1) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: 'Enter a site name and a path',
          icon: 'warning'
        })
        return
      }
      this.newSiteDialog = false
      try {
        await this.$apollo.mutate({
          mutation: createSiteMutation,
          variables: {
            name: this.newSiteName,
            path: this.newSitePath
          },
          update (store, resp) {
            const data = _.get(resp, 'data.createSite', { operation: {} })
            console.log('Mutation response:', resp)
            if (data.operation.succeeded === true) {
              const apolloData = store.readQuery({ query: sitesQuery })
              data.site.userCount = 0
              apolloData.sites.list.push(data.site)
              store.writeQuery({ query: sitesQuery, data: apolloData })
            } else {
              throw new Error(data.operation.message)
            }
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-sites-create')
          }
        })
        this.newSiteName = ''
        this.newSitePath = ''
        this.$store.commit('showNotification', {
          style: 'success',
          message: `Site has been created successfully.`,
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    sites: {
      query: sitesQuery,
      fetchPolicy: 'network-only',
      update: (data) => { console.log('Received data from GraphQL query:', data); return data.sites} ,
      watchLoading (isLoading) {
        this.loading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-sites-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
