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
      v-toolbar(color='grey lighten-4', flat, height='58')
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
        v-divider.mx-3(vertical)
        .overline Order By
        v-select.ml-2(
          :items='orderByItems'
          v-model='orderBy'
          background-color='white'
          hide-details
          label='Order By'
          rounded
          single-line
          dense
          height='40'
          style='max-width: 250px;'
        )
        v-divider.mx-3(vertical)
        v-btn-toggle(v-model='displayStyle', rounded, mandatory)
          v-btn(text, height='40'): v-icon(small) mdi-view-list
          v-btn(text, height='40'): v-icon(small) mdi-cards-variant
          v-btn(text, height='40'): v-icon(small) mdi-format-align-justify
      v-divider
    nav-footer
    notify
    search-results
</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'

import tagsQuery from 'gql/common/common-pages-query-tags.gql'

export default {
  data() {
    return {
      tags: [],
      selection: [],
      displayStyle: 0,
      orderBy: 'TITLE',
      orderByItems: [
        { text: 'Creation Date', value: 'CREATED' },
        { text: 'ID', value: 'ID' },
        { text: 'Last Modified', value: 'UPDATED' },
        { text: 'Path', value: 'PATH' },
        { text: 'Title', value: 'TITLE' }
      ],
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
  created () {
    this.$store.commit('page/SET_MODE', 'tags')
  },
  methods: {
    toggleTag (tag) {
      if (_.includes(this.selection, tag)) {
        this.selection = _.without(this.selection, tag)
      } else {
        this.selection.push(tag)
      }
    },
    isSelected (tag) {
      return _.includes(this.selection, tag)
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
