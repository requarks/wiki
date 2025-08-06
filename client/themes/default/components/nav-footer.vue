<template lang="pug">
  v-footer.justify-center(:color='bgColor', inset)
    .caption.grey--text(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-1`')
      template(v-if='footerOverride')
        span(v-html='footerOverrideRender + ` |&nbsp;`')
      template(v-else-if='company && company.length > 0 && contentLicense !== ``')
        span(v-if='contentLicense === `alr`') {{ $t('common:footer.copyright', { company: company, year: currentYear, interpolation: { escapeValue: false } }) }} |&nbsp;
        span(v-else) {{ $t('common:footer.license', { company: company, license: $t('common:license.' + contentLicense), interpolation: { escapeValue: false } }) }} |&nbsp;
      //- DISCLAIMER (MANDATORY) FOOTER
      .login-disclaimer.mt-6
        .body-2
          | Please review the
          a(
            href='https://talent.capgemini.com/media_library/Medias/Group_IT/MURAL_Data_Protection_Notice-v2.pdf'
            target='_blank'
            rel='noopener'
          )  Data Protection Notice
          |  before sharing any personal and/or confidential data.
          | Note that "Company sensitive" (SEC 3) information must not be shared in {{wikiName}}
      .d-flex.justify-center.mt-2
        span {{ $t('common:footer.poweredBy') }} #[a(href='https://wiki.js.org', ref='nofollow') Wiki.js]
</template>

<script>
import { get } from 'vuex-pathify'
import MarkdownIt from 'markdown-it'
/* global siteConfig */

const md = new MarkdownIt({
  html: false,
  breaks: false,
  linkify: true
})

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
      currentYear: new Date().getFullYear(),
      wikiName: siteConfig.title || "Wiki.js",
    };
  },
  computed: {
    company: get('site/company'),
    contentLicense: get('site/contentLicense'),
    footerOverride: get('site/footerOverride'),
    footerOverrideRender () {
      if (!this.footerOverride) { return '' }
      return md.renderInline(this.footerOverride)
    },
    bgColor() {
      if (!this.$vuetify.theme.dark) {
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
      background: mc('primary', '1');

      span {
        color: mc('blue', '300');
      }

      a {
        color: mc('blue', '200');
      }
    }
  }
</style>
