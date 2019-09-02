<template lang='pug'>
  v-app(:dark='darkMode').tags
    nav-header
    v-navigation-drawer.pb-0.elevation-1(app, fixed, clipped, :right='$vuetify.rtl', permanent, width='300')
      vue-scroll(:ops='scrollStyle')
        v-list(dense, nav)
          v-list-item(href='/')
            v-list-item-icon: v-icon mdi-home
            v-list-item-title {{$t('common:header.home')}}
          template(v-for='(tags, groupName) in tagsGrouped')
            v-divider.my-2
            v-subheader.pl-4(:key='`tagGroup-` + groupName') {{groupName}}
            v-list-item(v-for='tag of tags', @click='toggleTag(tag.tag)', :key='`tag-` + tag.tag')
              v-list-item-icon
                v-icon(v-if='isSelected(tag.tag)', color='primary') mdi-checkbox-intermediate
                v-icon(v-else) mdi-checkbox-blank-outline
              v-list-item-title {{tag.title}}
    v-content
      v-toolbar(color='primary', dark, flat, height='58')
        template(v-if='selection.length > 0')
          .overline.mr-3.animated.fadeInLeft Current Selection
          v-chip.mr-3.primary--text(
            v-for='tag of tagsSelected'
            :key='`tagSelected-` + tag.tag'
            color='white'
            close
            @click:close='toggleTag(tag.tag)'
            ) {{tag.title}}
          v-spacer
          v-btn.animated.fadeIn(
            small
            outlined
            color='blue lighten-4'
            rounded
            @click='selection = []'
            )
            v-icon(left) mdi-close
            span Clear Selection
        template(v-else)
          v-icon.mr-3.animated.fadeInRight mdi-arrow-left
          .overline.animated.fadeInRight Select one or more tags
      v-toolbar(:color='$vuetify.theme.dark ? `grey darken-4-l5` : `grey lighten-4`', flat, height='58')
        v-text-field.tags-search(
          label='Search within results...'
          solo
          hide-details
          flat
          rounded
          single-line
          height='40'
          prepend-icon='mdi-file-document-box-search-outline'
          append-icon='mdi-arrow-right'
        )
        template(v-if='locales.length > 1')
          v-divider.mx-3(vertical)
          .overline Locale
          v-select.ml-2(
            :items='locales'
            v-model='locale'
            :background-color='$vuetify.theme.dark ? `grey darken-3` : `white`'
            hide-details
            label='Locale'
            item-text='name'
            item-value='code'
            rounded
            single-line
            dense
            height='40'
            style='max-width: 170px;'
          )
        v-divider.mx-3(vertical)
        .overline Order By
        v-select.ml-2(
          :items='orderByItems'
          v-model='orderBy'
          :background-color='$vuetify.theme.dark ? `grey darken-3` : `white`'
          hide-details
          label='Order By'
          rounded
          single-line
          dense
          height='40'
          style='max-width: 250px;'
        )
        v-btn-toggle.ml-2(v-model='orderByDirection', rounded, mandatory)
          v-btn(text, height='40'): v-icon(size='20') mdi-chevron-double-up
          v-btn(text, height='40'): v-icon(size='20') mdi-chevron-double-down
      v-divider
      .text-center.pt-10
        img(src='/svg/icon-price-tag.svg')
        .subtitle-2.grey--text Select one or more tags on the left.
    nav-footer
    notify
    search-results
</template>

<script>
import { get } from 'vuex-pathify'
import VueRouter from 'vue-router'
import _ from 'lodash'

import tagsQuery from 'gql/common/common-pages-query-tags.gql'

/* global siteLangs */

const router = new VueRouter({
  mode: 'history',
  base: '/t'
})

export default {
  data() {
    return {
      tags: [],
      selection: [],
      locale: 'any',
      locales: [],
      orderBy: 'TITLE',
      orderByItems: [
        { text: 'Creation Date', value: 'CREATED' },
        { text: 'ID', value: 'ID' },
        { text: 'Last Modified', value: 'UPDATED' },
        { text: 'Path', value: 'PATH' },
        { text: 'Title', value: 'TITLE' }
      ],
      orderByDirection: 0,
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollY: 0,
          initialScrollX: 0,
          scrollingX: false,
          easing: 'easeOutQuad',
          speed: 1000,
          verticalNativeBarPos: this.$vuetify.rtl ? `left` : `right`
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#CCC',
          hoverStyle: {
            background: '#999'
          }
        }
      }
    }
  },
  computed: {
    darkMode: get('site/dark'),
    tagsGrouped () {
      return _.groupBy(this.tags, t => t.title.charAt(0).toUpperCase())
    },
    tagsSelected () {
      return _.filter(this.tags, t => _.includes(this.selection, t.tag))
    }
  },
  watch: {
    locale (newValue, oldValue) {
      this.rebuildURL()
    },
    orderBy (newValue, oldValue) {
      this.rebuildURL()
    },
    orderByDirection (newValue, oldValue) {
      this.rebuildURL()
    }
  },
  router,
  created () {
    this.$store.commit('page/SET_MODE', 'tags')

    this.locales = _.concat(
      [{name: 'Any', code: 'any'}],
      (siteLangs.length > 0 ? siteLangs : [])
    )

    this.selection = _.compact(this.$route.path.split('/'))
  },
  methods: {
    toggleTag (tag) {
      if (_.includes(this.selection, tag)) {
        this.selection = _.without(this.selection, tag)
      } else {
        this.selection.push(tag)
      }
      this.rebuildURL()
    },
    isSelected (tag) {
      return _.includes(this.selection, tag)
    },
    rebuildURL () {
      let urlObj = {
        path: '/' + this.selection.join('/')
      }
      if (this.locale !== `any`) {
        _.set(urlObj, 'query.lang', this.locale)
      }
      if (this.orderBy !== `TITLE`) {
        _.set(urlObj, 'query.sort', this.orderBy.toLowerCase())
      }
      if (this.orderByDirection !== 0) {
        _.set(urlObj, 'query.dir', this.orderByDirection === 0 ? `asc` : `desc`)
      }
      this.$router.push(urlObj)
    }
  },
  apollo: {
    tags: {
      query: tagsQuery,
      fetchPolicy: 'cache-and-network',
      update: (data) => _.cloneDeep(data.pages.tags),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'tags-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.tags-search {
  .v-input__control {
    min-height: initial !important;
  }
  .v-input__prepend-outer {
    margin-top: 8px !important;
  }
}
</style>
