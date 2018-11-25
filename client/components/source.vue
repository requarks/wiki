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
          v-card.grey.lighten-4.radius-7(flat)
            v-card-text
              pre
                code
                  slot

    nav-footer
</template>

<script>
/* global siteConfig */

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
    darkMode() { return siteConfig.darkMode }
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

    &::before {
      display: none;
    }
  }
}

</style>
