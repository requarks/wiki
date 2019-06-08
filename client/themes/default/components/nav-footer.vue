<template lang="pug">
  v-footer.justify-center(:color='bgColor', inset)
    .caption.grey--text.text--darken-1
      span(v-if='company && company.length > 0') {{ $t('common:footer.copyright', { company: company, year: currentYear, interpolation: { escapeValue: false } }) }} |&nbsp;
      span {{ $t('common:footer.poweredBy') }} #[a(href='https://wiki.js.org', ref='nofollow') Wiki.js]
</template>

<script>
import { get } from 'vuex-pathify'

export default {
  props: {
    color: {
      type: String,
      default: 'grey lighten-3'
    },
    darkColor: {
      type: String,
      default: 'grey darken-3'
    }
  },
  data() {
    return {
      currentYear: (new Date()).getFullYear()
    }
  },
  computed: {
    company: get('site/company'),
    darkMode: get('site/dark'),
    bgColor() {
      if (!this.darkMode) {
        return this.color
      } else {
        return this.darkColor
      }
    }
  }
}
</script>

<style lang="scss">
  .v-footer {
    a {
      text-decoration: none;
    }

    &.altbg {
      background: mc('theme', 'primary');

      span {
        color: mc('blue', '300');
      }

      a {
        color: mc('blue', '200');
      }
    }
  }
</style>
