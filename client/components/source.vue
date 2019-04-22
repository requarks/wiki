<template lang='pug'>
  v-app(:dark='darkMode').source
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        .subheading Viewing source of page #[strong /{{path}}]
        v-spacer
        .caption.blue--text.text--lighten-3 ID {{pageId}}
        v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') Return to Normal View
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
      window.location.assign(`/${this.path}`)
    }
  }
}
</script>

<style lang='scss'>

.source {
  pre > code {
    box-shadow: none;
    color: mc('grey', '800');
    font-family: 'Source Code Pro', sans-serif;
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
