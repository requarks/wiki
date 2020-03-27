<template lang='pug'>
  v-app(:dark='darkMode').source
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        i18next.subheading(v-if='versionId > 0', path='common:page.viewingSourceVersion', tag='div')
          strong(place='date', :title='$options.filters.moment(versionDate, `LLL`)') {{versionDate | moment('lll')}}
          strong(place='path') /{{path}}
        i18next.subheading(v-else, path='common:page.viewingSource', tag='div')
          strong(place='path') /{{path}}
        template(v-if='$vuetify.breakpoint.mdAndUp')
          v-spacer
          .caption.blue--text.text--lighten-3 {{$t('common:page.id', { id: pageId })}}
          .caption.blue--text.text--lighten-3.ml-4(v-if='versionId > 0') {{$t('common:page.versionId', { id: versionId })}}
          v-btn.ml-4(v-if='versionId > 0', depressed, color='blue darken-1', @click='goHistory')
            v-icon mdi-history
          v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') {{$t('common:page.returnNormalView')}}
      v-card(tile)
        v-card-text
          v-card.grey.radius-7(flat, :class='darkMode ? `darken-4` : `lighten-4`')
            v-card-text
              pre
                code
                  slot

    nav-footer
    notify
    search-results
</template>

<script>
import { get } from 'vuex-pathify'

export default {
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
    versionId: {
      type: Number,
      default: 0
    },
    versionDate: {
      type: String,
      default: ''
    }
  },
  data() {
    return {}
  },
  computed: {
    darkMode: get('site/dark')
  },
  created () {
    this.$store.commit('page/SET_ID', this.id)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'history')
  },
  methods: {
    goLive() {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    goHistory () {
      window.location.assign(`/h/${this.locale}/${this.path}`)
    }
  }
}
</script>

<style lang='scss'>

.source {
  pre > code {
    box-shadow: none;
    color: mc('grey', '800');
    font-family: 'Roboto Mono', sans-serif;
    font-weight: 400;
    font-size: 1rem;

    @at-root .theme--dark.source pre > code {
      background-color: mc('grey', '900');
      color: mc('grey', '400');
    }

    &::before {
      display: none;
    }
  }
}

</style>
