<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-categorize.svg', alt='General', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:general.title') }}
            .subheading.grey--text.animated.fadeInLeft {{ $t('admin:general.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card.wiki-form.animated.fadeInUp
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:general.siteInfo') }}
                  v-subheader General
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Site URL'
                      required
                      :counter='255'
                      v-model='config.host'
                      prepend-icon='label_important'
                      hint='Full URL to your wiki, without the trailing slash. (e.g. https://wiki.example.com)'
                      persistent-hint
                      )
                    v-text-field.mt-2(
                      outline
                      label='Site Title'
                      required
                      :counter='50'
                      v-model='config.title'
                      prepend-icon='public'
                      hint='Displayed in the top bar and appended to all pages meta title.'
                      persistent-hint
                      )
                  v-divider
                  v-subheader Logo #[v-chip.ml-2(label, color='grey', small, outline) coming soon]
                  v-card-text.pb-4.pl-5
                    v-layout.px-3(row, align-center)
                      v-avatar(size='100', :color='$vuetify.dark ? `grey darken-2` : `grey lighten-3`', :tile='config.logoIsSquare')
                      .ml-4
                        v-btn.mx-0(color='teal', depressed, disabled)
                          v-icon(left) cloud_upload
                          span Upload Logo
                        v-btn(color='teal', depressed, disabled)
                          v-icon(left) clear
                          span Clear
                        .caption.grey--text An image of 120x120 pixels is recommended for best results.
                        .caption.grey--text SVG, PNG or JPG files only.
                  v-divider
                  v-subheader Footer Copyright
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Company / Organization Name'
                      v-model='config.company'
                      :counter='255'
                      prepend-icon='business'
                      persistent-hint
                      hint='Name to use when displaying copyright notice in the footer. Leave empty to hide.'
                      )
                  v-divider
                  v-subheader SEO
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Site Description'
                      :counter='255'
                      v-model='config.description'
                      prepend-icon='explore'
                      hint='Default description when none is provided for a page.'
                      persistent-hint
                      )
                    v-select.mt-2(
                      outline
                      label='Meta Robots'
                      multiple
                      :items='metaRobots'
                      v-model='config.robots'
                      prepend-icon='explore'
                      :return-object='false'
                      hint='Default: Index, Follow. Can also be set on a per-page basis.'
                      persistent-hint
                      )

            v-flex(lg6 xs12)
              v-card.wiki-form.animated.fadeInUp.wait-p4s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Features
                  v-spacer
                  v-chip(label, color='white', small).primary--text coming soon
                v-card-text
                  v-switch(
                    label='Analytics'
                    color='primary'
                    v-model='config.featureAnalytics'
                    persistent-hint
                    hint='Enable site analytics using service provider.'
                    disabled
                    )
                  v-select.mt-3(
                    outline
                    label='Analytics Service Provider'
                    :items='analyticsServices'
                    v-model='config.analyticsService'
                    prepend-icon='subdirectory_arrow_right'
                    persistent-hint
                    hint='Automatically add tracking code for services like Google Analytics.'
                    disabled
                    )
                  v-text-field.mt-2(
                    v-if='config.analyticsService !== ``'
                    outline
                    label='Property Tracking ID'
                    :counter='255'
                    v-model='config.analyticsId'
                    prepend-icon='timeline'
                    persistent-hint
                    hint='A unique identifier provided by your analytics service provider.'
                    )

                  v-divider.mt-3
                  v-switch(
                    label='Asset Image Optimization'
                    color='primary'
                    v-model='config.featureTinyPNG'
                    persistent-hint
                    hint='Image optimization tool to reduce filesize and bandwidth costs.'
                    disabled
                    )
                  v-text-field.mt-3(
                    outline
                    label='TinyPNG API Key'
                    :counter='255'
                    v-model='config.description'
                    prepend-icon='subdirectory_arrow_right'
                    hint='Get your API key at https://tinypng.com/developers'
                    persistent-hint
                    disabled
                    )

                  v-divider.mt-3
                  v-switch(
                    label='Page Ratings'
                    color='primary'
                    v-model='config.featurePageRatings'
                    persistent-hint
                    hint='Allow users to rate pages.'
                    )

                  v-divider.mt-3
                  v-switch(
                    label='Page Comments'
                    color='primary'
                    v-model='config.featurePageComments'
                    persistent-hint
                    hint='Allow users to leave comments on pages.'
                    )

                  v-divider.mt-3
                  v-switch(
                    label='Personal Wikis'
                    color='primary'
                    v-model='config.featurePersonalWikis'
                    persistent-hint
                    hint='Allow users to have their own personal wiki.'
                    )

</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import siteConfigQuery from 'gql/admin/site/site-query-config.gql'
import siteUpdateConfigMutation from 'gql/admin/site/site-mutation-save-config.gql'

export default {
  data() {
    return {
      analyticsServices: [
        { text: 'None', value: '' },
        { text: 'Elasticsearch APM', value: 'elk' },
        { text: 'Google Analytics', value: 'ga' },
        { text: 'Google Tag Manager', value: 'gtm' }
      ],
      metaRobots: [
        { text: 'Index', value: 'index' },
        { text: 'Follow', value: 'follow' },
        { text: 'No Index', value: 'noindex' },
        { text: 'No Follow', value: 'nofollow' }
      ],
      config: {
        host: '',
        title: '',
        description: '',
        robots: [],
        analyticsService: '',
        analyticsId: '',
        company: '',
        hasLogo: false,
        logoIsSquare: false,
        featureAnalytics: false,
        featurePageRatings: false,
        featurePageComments: false,
        featurePersonalWikis: false,
        featureTinyPNG: false
      }
    }
  },
  computed: {
    darkMode: get('site/dark'),
    siteTitle: sync('site/title'),
    company: sync('site/company')
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: siteUpdateConfigMutation,
          variables: {
            host: this.config.host || '',
            title: this.config.title || '',
            description: this.config.description || '',
            robots: this.config.robots || [],
            analyticsService: this.config.analyticsService || '',
            analyticsId: this.config.analyticsId || '',
            company: this.config.company || '',
            hasLogo: this.config.hasLogo || false,
            logoIsSquare: this.config.logoIsSquare || false,
            featurePageRatings: this.config.featurePageRatings || false,
            featurePageComments: this.config.featurePageComments || false,
            featurePersonalWikis: this.config.featurePersonalWikis || false
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Configuration saved successfully.',
          icon: 'check'
        })
        this.siteTitle = this.config.title
        this.company = this.config.company
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    config: {
      query: siteConfigQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.site.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
