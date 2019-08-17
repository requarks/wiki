<template lang="pug">
  v-app(v-scroll='upBtnScroll', :dark='darkMode')
    nav-header
    v-navigation-drawer(
      :class='darkMode ? `grey darken-4-d4` : `primary`'
      dark
      app
      clipped
      mobile-break-point='600'
      :temporary='$vuetify.breakpoint.mdAndDown'
      v-model='navShown'
      :right='$vuetify.rtl'
      )
      vue-scroll(:ops='scrollStyle')
        nav-sidebar(:color='darkMode ? `grey darken-4-d4` : `primary`', :items='sidebar')

    v-fab-transition
      v-btn(
        fab
        color='primary'
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        @click='navShown = !navShown'
        v-if='$vuetify.breakpoint.mdAndDown'
        v-show='!navShown'
        )
        v-icon mdi-menu

    v-content(ref='content')
      template(v-if='path !== `home`')
        v-toolbar(:color='darkMode ? `grey darken-4-d3` : `grey lighten-3`', flat, dense, v-if='$vuetify.breakpoint.smAndUp')
          //- v-btn.pl-0(v-if='$vuetify.breakpoint.xsOnly', flat, @click='toggleNavigation')
          //-   v-icon(color='grey darken-2', left) menu
          //-   span Navigation
          v-breadcrumbs.breadcrumbs-nav.pl-0(
            :items='breadcrumbs'
            divider='/'
            )
            template(slot='item', slot-scope='props')
              v-icon(v-if='props.item.path === "/"', small, @click='goHome') mdi-home
              v-btn.ma-0(v-else, :href='props.item.path', small, text) {{props.item.name}}
          template(v-if='!isPublished')
            v-spacer
            .caption.red--text {{$t('common:page.unpublished')}}
            status-indicator.ml-3(negative, pulse)
        v-divider
      v-container.grey.pa-0(fluid, :class='darkMode ? `darken-4-l3` : `lighten-4`')
        v-row(no-gutters, align-content='center', style='height: 90px;')
          v-col.pl-4(offset-xl='2', offset-lg='3')
            .headline.grey--text(:class='darkMode ? `text--lighten-2` : `text--darken-3`') {{title}}
            .caption.grey--text.text--darken-1 {{description}}
      v-divider
      v-container.pl-5.pt-4(fluid, grid-list-xl)
        v-layout(row)
          v-flex.page-col-sd(lg3, xl2, v-if='$vuetify.breakpoint.lgAndUp', style='margin-top: -90px;')
            v-card(v-if='toc.length')
              .overline.pa-5.pb-0(:class='darkMode ? `blue--text text--lighten-2` : `primary--text`') {{$t('common:page.toc')}}
              v-list.pb-3(dense, nav, :class='darkMode ? `darken-3-d3` : ``')
                template(v-for='(tocItem, tocIdx) in toc')
                  v-list-item(@click='$vuetify.goTo(tocItem.anchor, scrollOpts)')
                    v-icon(color='grey', small) {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
                    v-list-item-title.px-3 {{tocItem.title}}
                  //- v-divider(v-if='tocIdx < toc.length - 1 || tocItem.children.length')
                  template(v-for='tocSubItem in tocItem.children')
                    v-list-item(@click='$vuetify.goTo(tocSubItem.anchor, scrollOpts)')
                      v-icon.px-3(color='grey lighten-1', small) {{ $vuetify.rtl ? `mdi-chevron-left` : `mdi-chevron-right` }}
                      v-list-item-title.px-3.caption.grey--text(:class='darkMode ? `text--lighten-1` : `text--darken-1`') {{tocSubItem.title}}
                    //- v-divider(inset, v-if='tocIdx < toc.length - 1')

            v-card.mt-5
              .pa-5.pt-3
                .overline.indigo--text.d-flex.align-center(:class='$vuetify.theme.dark ? `text--lighten-3` : ``')
                  span {{$t('common:page.lastEditedBy')}}
                  v-spacer
                  v-tooltip(top, v-if='isAuthenticated')
                    template(v-slot:activator='{ on }')
                      v-btn.btn-animate-edit(icon, :href='"/h/" + locale + "/" + path', v-on='on', x-small)
                        v-icon(color='grey', dense) mdi-history
                    span History
                .body-2.grey--text(:class='darkMode ? `` : `text--darken-3`') {{ authorName }}
                .caption.grey--text.text--darken-1 {{ updatedAt | moment('calendar') }}

            v-card.mt-5(v-if='tags.length > 0 || true')
              .pa-5
                .overline.teal--text.pb-2(:class='$vuetify.theme.dark ? `text--lighten-3` : ``') Tags
                v-chip.mr-1(
                  label
                  color='teal lighten-5'
                  v-for='(tag, idx) in tags'
                  :href='`/t/` + tag.slug'
                  :key='tag.slug'
                  )
                  v-icon(color='teal', left, small) mdi-label
                  span.teal--text.text--darken-2 {{tag.text}}

            v-card.mt-5
              .pa-5
                .overline.pb-2.yellow--text(:class='$vuetify.theme.dark ? `text--darken-3` : `text--darken-4`') Rating
                .text-center
                  v-rating(
                    v-model='rating'
                    color='yellow darken-3'
                    background-color='grey lighten-1'
                    half-increments
                    hover
                  )
                  .caption.grey--text 5 votes
              v-divider
              v-toolbar(:color='darkMode ? `grey darken-3` : `grey lighten-4`', flat, dense)
                v-spacer
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, small, v-on='on'): v-icon(color='grey') mdi-bookmark
                  span {{$t('common:page.bookmark')}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, small, v-on='on'): v-icon(color='grey') mdi-share-variant
                  span {{$t('common:page.share')}}
                v-tooltip(bottom)
                  template(v-slot:activator='{ on }')
                    v-btn(icon, tile, small, v-on='on'): v-icon(color='grey') mdi-printer
                  span {{$t('common:page.printFormat')}}
                v-spacer

          v-flex.page-col-content(xs12, lg9, xl10)
            v-tooltip(:right='$vuetify.rtl', :left='!$vuetify.rtl', v-if='isAuthenticated')
              template(v-slot:activator='{ on }')
                v-btn.btn-animate-edit(
                  fab
                  bottom
                  :right='!$vuetify.rtl'
                  :left='$vuetify.rtl'
                  color='primary'
                  fixed
                  dark
                  :href='"/e/" + locale + "/" + path'
                  v-on='on'
                  )
                  v-icon mdi-pencil
              span {{$t('common:page.editPage')}}
            .contents(ref='container')
              slot(name='contents')
    nav-footer
    notify
    search-results
    v-fab-transition
      v-btn(
        v-if='upBtnShown'
        fab
        fixed
        bottom
        :right='$vuetify.rtl'
        :left='!$vuetify.rtl'
        small
        depressed
        @click='$vuetify.goTo(0, scrollOpts)'
        color='primary'
        dark
        :style='$vuetify.rtl ? `right: 235px;` : `left: 235px;`'
        )
        v-icon mdi-arrow-up
</template>

<script>
import { StatusIndicator } from 'vue-status-indicator'
import Prism from 'prismjs'
import { get } from 'vuex-pathify'
import _ from 'lodash'

Prism.plugins.autoloader.languages_path = '/js/prism/'
Prism.plugins.NormalizeWhitespace.setDefaults({
  'remove-trailing': true,
  'remove-indent': true,
  'left-trim': true,
  'right-trim': true,
  'break-lines': 160,
  'remove-initial-line-feed': true,
  'tabs-to-spaces': 2
})

export default {
  components: {
    StatusIndicator
  },
  props: {
    pageId: {
      type: Number,
      default: 0
    },
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    },
    title: {
      type: String,
      default: 'Untitled Page'
    },
    description: {
      type: String,
      default: ''
    },
    createdAt: {
      type: String,
      default: ''
    },
    updatedAt: {
      type: String,
      default: ''
    },
    tags: {
      type: Array,
      default: () => ([])
    },
    authorName: {
      type: String,
      default: 'Unknown'
    },
    authorId: {
      type: Number,
      default: 0
    },
    isPublished: {
      type: Boolean,
      default: false
    },
    toc: {
      type: Array,
      default: () => []
    },
    sidebar: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      navShown: false,
      navExpanded: false,
      upBtnShown: false,
      scrollOpts: {
        duration: 1500,
        offset: -75,
        easing: 'easeInOutCubic'
      },
      scrollStyle: {
        vuescroll: {},
        scrollPanel: {
          initialScrollX: 0.01, // fix scrollbar not disappearing on load
          scrollingX: false,
          speed: 50
        },
        rail: {
          gutterOfEnds: '2px'
        },
        bar: {
          onlyShowBarOnScroll: false,
          background: '#42A5F5',
          hoverStyle: {
            background: '#64B5F6'
          }
        }
      }
    }
  },
  computed: {
    darkMode: get('site/dark'),
    isAuthenticated: get('user/authenticated'),
    rating: {
      get () {
        return 3.5
      },
      set (val) {

      }
    },
    breadcrumbs() {
      return [{ path: '/', name: 'Home' }].concat(_.reduce(this.path.split('/'), (result, value, key) => {
        result.push({
          path: _.map(result, 'path').join('/') + `/${value}`,
          name: value
        })
        return result
      }, []))
    }
  },
  created() {
    this.$store.commit('page/SET_AUTHOR_ID', this.authorId)
    this.$store.commit('page/SET_AUTHOR_NAME', this.authorName)
    this.$store.commit('page/SET_CREATED_AT', this.createdAt)
    this.$store.commit('page/SET_DESCRIPTION', this.description)
    this.$store.commit('page/SET_IS_PUBLISHED', this.isPublished)
    this.$store.commit('page/SET_ID', this.pageId)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)
    this.$store.commit('page/SET_TAGS', this.tags)
    this.$store.commit('page/SET_TITLE', this.title)
    this.$store.commit('page/SET_UPDATED_AT', this.updatedAt)

    this.$store.commit('page/SET_MODE', 'view')
  },
  mounted () {
    Prism.highlightAllUnder(this.$refs.container)
    this.navShown = this.$vuetify.breakpoint.smAndUp
  },
  methods: {
    goHome () {
      window.location.assign('/')
    },
    toggleNavigation () {
      this.navOpen = !this.navOpen
    },
    upBtnScroll () {
      const scrollOffset = window.pageYOffset || document.documentElement.scrollTop
      this.upBtnShown = scrollOffset > window.innerHeight * 0.33
    }
  }
}
</script>

<style lang="scss">

.breadcrumbs-nav {
  .v-btn {
    min-width: 0;
    &__content {
      text-transform: none;
    }
  }
  .v-breadcrumbs__divider:nth-child(2n) {
    padding: 0 6px;
  }
  .v-breadcrumbs__divider:nth-child(2) {
    padding: 0 6px 0 12px;
  }
}

</style>
