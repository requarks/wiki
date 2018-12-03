<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          v-icon(size='80', color='grey lighten-2') widgets
          .admin-header-title
            .headline.primary--text {{ $t('admin:general.title') }}
            .subheading.grey--text {{ $t('admin:general.subtitle') }}
          v-spacer
          v-btn(color='success', depressed, @click='save', large)
            v-icon(left) check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card.wiki-form
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading {{ $t('admin:general.siteInfo') }}
                  v-subheader General
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Site Title'
                      required
                      :counter='50'
                      v-model='siteTitle'
                      prepend-icon='public'
                      )
                  v-divider
                  v-subheader SEO
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Site Description'
                      :counter='255'
                      prepend-icon='public'
                      )
                    v-text-field(
                      outline
                      label='Site Keywords'
                      :counter='255'
                      prepend-icon='public'
                      )
                    v-select(
                      outline
                      label='Meta Robots'
                      chips
                      tags
                      :items='metaRobots'
                      v-model='metaRobotsSelection'
                      prepend-icon='public'
                      )
                  v-divider
                  v-subheader Analytics
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Google Analytics ID'
                      :counter='255'
                      prepend-icon='public'
                      persistent-hint
                      hint='Property tracking ID for Google Analytics.'
                      )
                  v-divider
                  v-subheader Footer Copyright
                  .px-3.pb-3
                    v-text-field(
                      outline
                      label='Company / Organization Name'
                      v-model='company'
                      :counter='255'
                      prepend-icon='public'
                      persistent-hint
                      hint='Name to use when displaying copyright notice in the footer. Leave empty to hide.'
                      )
            v-flex(lg6 xs12)
              v-card.wiki-form
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading {{ $t('admin:general.siteBranding') }}
                v-card-text
                  v-layout.pa-3(row, align-center)
                    v-avatar(size='120', color='grey lighten-3', :tile='useSquareLogo')
                    .ml-4
                      v-layout(row, align-center)
                        v-btn(color='teal', depressed, dark)
                          v-icon(left) cloud_upload
                          span Upload Logo
                        v-btn(color='teal', depressed, disabled)
                          v-icon(left) clear
                          span Clear
                      .caption.grey--text An image of 120x120 pixels is recommended for best results.
                      .caption.grey--text SVG, PNG or JPG files only.
                  v-switch(
                    v-model='useSquareLogo'
                    label='Use Square Logo Frame'
                    color='primary'
                    persistent-hint
                    hint='Check this option if a round logo frame doesn\'t work with your logo.'
                    )
                  v-divider.mt-3
                  v-switch(
                    v-model='displayMascot'
                    label='Display Wiki.js Mascot'
                    color='primary'
                    persistent-hint
                    hint='Uncheck this box if you don\'t want Henry, Wiki.js mascot, to be displayed on client-facing pages.'
                    )

              v-card.wiki-form.mt-3
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Features
                v-card-text
                  v-switch(
                    v-model='featurePageRatings'
                    label='Page Ratings'
                    color='primary'
                    persistent-hint
                    hint='Allow users to rate pages.'
                    )
                  v-divider.mt-3
                  v-switch(
                    v-model='featurePersonalWiki'
                    label='Personal Wikis'
                    color='primary'
                    persistent-hint
                    hint='Allow users to have their own personal wiki.'
                    )

</template>

<script>

import { get, sync } from 'vuex-pathify'

export default {
  data() {
    return {
      metaRobotsSelection: ['Index', 'Follow'],
      metaRobots: ['Index', 'Follow', 'No Index', 'No Follow'],
      useSquareLogo: false,
      displayMascot: true,
      featurePageRatings: true,
      featurePersonalWiki: true
    }
  },
  computed: {
    darkMode: get('site/dark'),
    siteTitle: sync('site/title'),
    company: sync('site/company')
  },
  methods: {
    async save () {
      this.$store.commit('showNotification', {
        message: 'Configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
