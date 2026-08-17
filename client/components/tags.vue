<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').tags
    nav-header
    nav-mobile-drawer-host
    nav-drawer-shell(
      v-if='$vuetify.breakpoint.mdAndUp'
      v-model='tagsDrawerShown'
      permanent
      category='tags'
      )
      nav-drawer-content-tags
    v-main.grey(:class='$vuetify.theme.dark ? `darken-4-d5` : `lighten-3`')
      v-toolbar.tags-selection-toolbar(color='primary', dark, flat, height='58', :class='{ "tags-selection-toolbar--active": hasSelection }')
        template(v-if='hasSelection')
          .tags-selection-scroll-wrap(:class='tagsScrollFadeClass')
            .tags-selection-scroll(
              ref='tagsSelectionScroll'
              @scroll='updateTagsScrollFades'
              )
              .tags-selection-chips
                v-chip.mr-3.primary--text(
                  v-for='tag of tagsSelected'
                  :key='`tagSelected-` + tag.tag'
                  color='white'
                  close
                  @click:close='toggleTag(tag.tag)'
                  ) {{tag.title}}
                v-btn.animated.fadeIn.ml-1(
                  v-if='$vuetify.breakpoint.mdAndUp'
                  small
                  outlined
                  color='blue lighten-4'
                  rounded
                  @click='selection = []'
                  )
                  v-icon(left) mdi-close
                  span {{$t('tags:clearSelection')}}
        template(v-else)
          v-icon.mr-3.animated.fadeInRight mdi-arrow-left
          .overline.animated.fadeInRight {{$t('tags:selectOneMoreTags')}}
      v-toolbar(:color='$vuetify.theme.dark ? `grey darken-4-l5` : `grey lighten-4`', flat, height='58')
        v-text-field.tags-search(
          v-model='innerSearch'
          :label='$t(`tags:searchWithinResultsPlaceholder`)'
          solo
          hide-details
          flat
          rounded
          single-line
          height='40'
          prepend-icon='mdi-text-box-search-outline'
          append-icon='mdi-arrow-right'
          clearable
        )
        template(v-if='showLocaleFilter')
          v-divider.mx-3(vertical)
          .overline {{$t('tags:locale')}}
          v-select.ml-2(
            :items='locales'
            v-model='locale'
            :background-color='$vuetify.theme.dark ? `grey darken-3` : `white`'
            hide-details
            :label='$t(`tags:locale`)'
            item-text='name'
            item-value='code'
            rounded
            single-line
            dense
            height='40'
            style='max-width: 170px;'
          )
        template(v-if='showOrderByFilter')
          v-divider.mx-3(vertical)
          .overline {{$t('tags:orderBy')}}
          v-select.ml-2(
            :items='orderByItems'
            v-model='orderBy'
            :background-color='$vuetify.theme.dark ? `grey darken-3` : `white`'
            hide-details
            :label='$t(`tags:orderBy`)'
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
      .text-center.pt-10(v-if='!hasSelection')
        img(src='/_assets/svg/icon-price-tag.svg')
        .subtitle-2.grey--text {{$t('tags:selectOneMoreTagsHint')}}
      .px-5.py-2(v-else)
        v-data-iterator(
          :items='pages'
          :items-per-page='4'
          :search='innerSearch'
          :loading='isLoading'
          :options.sync='pagination'
          @page-count='pageTotal = $event'
          hide-default-footer
          ref='dude'
          )
          template(v-slot:loading)
            .text-center.pt-10
              v-progress-circular(
                indeterminate
                color='primary'
                size='96'
                width='2'
                )
              .subtitle-2.grey--text.mt-5 {{$t('tags:retrievingResultsLoading')}}
          template(v-slot:no-data)
            .text-center.pt-10
              img(src='/_assets/svg/icon-info.svg')
              .subtitle-2.grey--text {{$t('tags:noResults')}}
          template(v-slot:no-results)
            .text-center.pt-10
              img(src='/_assets/svg/icon-info.svg')
              .subtitle-2.grey--text {{$t('tags:noResultsWithFilter')}}
          template(v-slot:default='props')
            v-row(align='stretch')
              v-col(
                v-for='item of props.items'
                :key='`page-` + item.id'
                cols='12'
                lg='6'
                )
                v-card.radius-7(
                  @click='goTo(item)'
                  style='height:100%;'
                  :class='$vuetify.theme.dark ? `grey darken-4` : ``'
                  )
                  v-card-text
                    .body-1: strong.primary--text {{item.title}}
                    .body-2.grey--text {{item.description || '---'}}
                    v-divider.my-2
                    .d-flex.flex-row.align-center
                      v-chip(small, label, :color='$vuetify.theme.dark ? `grey darken-3-l5` : `grey lighten-4`').overline {{item.locale}}
                      .caption.ml-1 / {{item.path}}
        .text-center.py-2.animated.fadeInDown(v-if='this.pageTotal > 1')
          v-pagination-bar(v-model='pagination.page', :length='pageTotal')

    nav-footer
    notify
    pwa-install-prompt
    search-results
</template>

<script>
import VueRouter from 'vue-router'

import tagsQuery from 'gql/common/common-pages-query-tags.gql'
import pagesQuery from 'gql/common/common-pages-query-list.gql'

/* global siteLangs */

const router = new VueRouter({
  mode: 'history',
  base: '/t'
})

export default {
  i18nOptions: { namespaces: 'tags' },
  components: {
    NavDrawerContentTags: () => import(/* webpackMode: "eager" */ './common/nav-drawer-content-tags.vue'),
    NavDrawerShell: () => import(/* webpackMode: "eager" */ './common/nav-drawer-shell.vue')
  },
  data() {
    return {
      tagsDrawerShown: true,
      tags: [],
      selection: [],
      innerSearch: '',
      locale: 'any',
      locales: [],
      orderBy: 'title',
      orderByDirection: 0,
      pagination: {
        page: 1,
        itemsPerPage: 12,
        mustSort: true,
        sortBy: ['title'],
        sortDesc: [false]
      },
      pages: [],
      pageTotal: 0,
      isLoading: true,
      tagsScrollFadeLeft: false,
      tagsScrollFadeRight: false
    }
  },
  computed: {
    hasSelection () {
      return Array.isArray(this.selection) && this.selection.length > 0
    },
    showLocaleFilter () {
      return this.locales.length > 1 && this.$vuetify.breakpoint.mdAndUp
    },
    showOrderByFilter () {
      return this.$vuetify.breakpoint.mdAndUp
    },
    tagsSelected () {
      return this.tags.filter(t => this.selection.includes(t.tag))
    },
    tagsScrollFadeClass () {
      return {
        'tags-selection-scroll-wrap--fade-left': this.tagsScrollFadeLeft,
        'tags-selection-scroll-wrap--fade-right': this.tagsScrollFadeRight
      }
    },
    orderByItems () {
      return [
        { text: this.$t('tags:orderByField.creationDate'), value: 'createdAt' },
        { text: this.$t('tags:orderByField.ID'), value: 'id' },
        { text: this.$t('tags:orderByField.lastModified'), value: 'updatedAt' },
        { text: this.$t('tags:orderByField.path'), value: 'path' },
        { text: this.$t('tags:orderByField.title'), value: 'title' }
      ]
    }
  },
  watch: {
    '$route' () {
      this.selection = decodeURI(this.$route.path).split('/').filter(Boolean)
    },
    locale (newValue, oldValue) {
      this.rebuildURL()
    },
    orderBy (newValue, oldValue) {
      this.rebuildURL()
      this.pagination.sortBy = [newValue]
    },
    orderByDirection (newValue, oldValue) {
      this.rebuildURL()
      this.pagination.sortDesc = [newValue === 1]
    },
    tagsSelected () {
      this.scheduleTagsScrollFadeUpdate()
    },
    selection () {
      this.scheduleTagsScrollFadeUpdate()
    }
  },
  router,
  created () {
    this.$store.commit('page/SET_MODE', 'tags')
    this.selection = decodeURI(this.$route.path).split('/').filter(Boolean)
  },
  mounted () {
    this.locales = [
      { name: this.$t('tags:localeAny'), code: 'any' },
      ...(siteLangs.length > 0 ? siteLangs : [])
    ]
    if (this.$route.query.lang) {
      this.locale = this.$route.query.lang
    }
    if (this.$route.query.sort) {
      this.orderBy = this.$route.query.sort.toLowerCase()
      switch (this.orderBy) {
        case 'updatedat':
          this.orderBy = 'updatedAt'
          break
      }
      this.pagination.sortBy = [this.orderBy]
    }
    if (this.$route.query.dir) {
      this.orderByDirection = this.$route.query.dir === 'asc' ? 0 : 1
      this.pagination.sortDesc = [this.orderByDirection === 1]
    }
    this.scheduleTagsScrollFadeUpdate()
    window.addEventListener('resize', this.updateTagsScrollFades, { passive: true })
  },
  beforeDestroy () {
    window.removeEventListener('resize', this.updateTagsScrollFades)
  },
  methods: {
    toggleTag (tag) {
      if (this.selection.includes(tag)) {
        this.selection = this.selection.filter(t => t !== tag)
      } else {
        this.selection.push(tag)
      }
      this.rebuildURL()
    },
    rebuildURL () {
      const query = {}
      if (this.locale !== 'any') {
        query.lang = this.locale
      }
      if (this.orderBy !== 'TITLE') {
        query.sort = this.orderBy.toLowerCase()
      }
      if (this.orderByDirection !== 0) {
        query.dir = this.orderByDirection === 0 ? 'asc' : 'desc'
      }
      this.$router.push({
        path: '/' + this.selection.join('/'),
        query
      })
    },
    goTo (page) {
      window.location.assign(`/${page.locale}/${page.path}`)
    },
    scheduleTagsScrollFadeUpdate () {
      this.$nextTick(() => {
        this.updateTagsScrollFades()
      })
    },
    updateTagsScrollFades () {
      const el = this.$refs.tagsSelectionScroll
      if (!el || !this.$vuetify.breakpoint.smAndDown) {
        this.tagsScrollFadeLeft = false
        this.tagsScrollFadeRight = false
        return
      }

      const maxScroll = el.scrollWidth - el.clientWidth
      if (maxScroll <= 1) {
        this.tagsScrollFadeLeft = false
        this.tagsScrollFadeRight = false
        return
      }

      this.tagsScrollFadeLeft = el.scrollLeft > 4
      this.tagsScrollFadeRight = el.scrollLeft < maxScroll - 4
    }
  },
  apollo: {
    tags: {
      query: tagsQuery,
      fetchPolicy: 'cache-and-network',
      update: (data) => JSON.parse(JSON.stringify(data.pages.tags)),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'tags-refresh')
      }
    },
    pages: {
      query: pagesQuery,
      fetchPolicy: 'cache-and-network',
      update: (data) => JSON.parse(JSON.stringify(data.pages.list)),
      watchLoading (isLoading) {
        this.isLoading = isLoading
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'pages-refresh')
      },
      variables () {
        return {
          locale: this.locale === 'any' ? null : this.locale,
          tags: this.selection
        }
      },
      skip () {
        return this.selection.length < 1
      }
    }
  }
}
</script>

<style lang='scss'>
@media #{map-get($display-breakpoints, 'sm-and-down')} {
  .tags,
  .tags .v-main,
  .tags .v-main__wrap {
    overflow-x: hidden;
    max-width: 100vw;
  }

  body.has-mobile-bottom-nav .tags .v-main__wrap {
    padding-bottom: 56px !important;
  }

  .tags-selection-toolbar--active {
    .v-toolbar__content {
      flex-wrap: nowrap !important;
      align-items: center;
      width: 100%;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
    }

    .tags-selection-scroll-wrap {
      position: relative;
      flex: 1 1 auto;
      min-width: 0;
      width: 100%;
      overflow: hidden;

      &::before,
      &::after {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: 28px;
        z-index: 2;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      &::before {
        left: 0;
        background: linear-gradient(to right, mc('theme', 'primary') 0%, rgba(mc('theme', 'primary'), 0) 100%);
      }

      &::after {
        right: 0;
        background: linear-gradient(to left, mc('theme', 'primary') 0%, rgba(mc('theme', 'primary'), 0) 100%);
      }

      &.tags-selection-scroll-wrap--fade-left::before {
        opacity: 1;
      }

      &.tags-selection-scroll-wrap--fade-right::after {
        opacity: 1;
      }
    }

    .tags-selection-scroll {
      width: 100%;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .tags-selection-chips {
      display: flex;
      flex-direction: row;
      flex-wrap: nowrap !important;
      align-items: center;
      flex: 0 0 auto;
      width: max-content;
      max-width: none;
    }

    .v-chip {
      flex: 0 0 auto;
      max-width: none;
      white-space: nowrap;

      .v-chip__content {
        white-space: nowrap;
      }
    }
  }
}

.tags-search {
  .v-input__control {
    min-height: initial !important;
  }
  .v-input__prepend-outer {
    margin-top: 8px !important;
  }
}
</style>
