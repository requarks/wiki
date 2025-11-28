<template lang="pug">
  v-footer.justify-center.nav-footer(:color='bgColor', inset)
    .caption.grey--text.footer-content(:class='$vuetify.theme.dark ? `text--lighten-1` : `text--darken-1`')
      //- Dynamic / Configurable license or override
      template(v-if='footerOverride')
        span(v-html='footerOverrideRender + ` |&nbsp;`')
      template(v-else-if='company && company.length > 0 && contentLicense !== ``')
        span(v-if='contentLicense === `alr`') {{ $t('common:footer.copyright', { company: company, year: currentYear, interpolation: { escapeValue: false } }) }} |&nbsp;
        span(v-else) {{ $t('common:footer.license', { company: company, license: $t('common:license.' + contentLicense), interpolation: { escapeValue: false } }) }} |&nbsp;
     
      .login-disclaimer.mt-6
        .body-2
          a.release-notes-link(@click='openReleaseNotes', href='javascript:void(0);', :aria-label='`Open Release Notes dialog`') Release Notes
          |  |&nbsp;
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

   
    v-dialog(v-model='releaseNotesDialog', max-width='60%', max-height='250', scrollable, :retain-focus='false')
      v-card
        v-card-title.d-flex.align-center(:color='$vuetify.theme.dark ? colors.surfaceDark.primaryBlueHeavy : colors.surfaceLight.primaryBlueHeavy', :style='{"background-color": $vuetify.theme.dark ? colors.surfaceDark.primaryBlueHeavy : colors.surfaceLight.primaryBlueHeavy, "color": colors.textDark.primary}')
          span.headline.font-weight-medium Release Notes
          v-spacer
          v-btn.mr-3(icon, @click='closeReleaseNotes', :aria-label='`Close Release Notes dialog`', :style='{"color": colors.textDark.primary}')
            v-icon mdi-close
        v-divider
        v-card-text
          // Loading state
          v-progress-linear(indeterminate, color='primary', class='mb-4', v-if='releaseNotesLoading')
          // Error state
          v-alert(type='error', outlined, dense, v-if='releaseNotesError') {{ releaseNotesError }}
          // Content
          div(v-if='!releaseNotesLoading && !releaseNotesError')
            div(v-if='releaseInfos.length === 0', class='body-2 grey--text text-center') No release notes available.
            div(v-for='ri in releaseInfos' :key='ri.versionNumber' class='mb-6 release-info-block')
              .body-1.font-weight-bold {{ ri.versionNumber }} · {{ formatDate(ri.releaseDate) }}
              ul.release-notes-list
                li(v-for='note in ri.notes' :key='note.id') {{ localizeNote(note) }}
        v-card-actions.d-flex.justify-end.pr-4
          v-btn.rounded-button(
            rounded
            depressed
            :dark='!$vuetify.theme.dark'
            :color='releaseNotesCloseColor'
            @click='closeReleaseNotes'
            :aria-label='`Close Release Notes dialog`'
          )
            span Close
</template>

<script>
import { get } from 'vuex-pathify'
import MarkdownIt from 'markdown-it'
import releaseInfosQuery from '@/graph/common/common-release-infos.gql'
import colors from '@/themes/default/js/color-scheme'
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
    },
    isHome: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      currentYear: new Date().getFullYear(),
      wikiName: siteConfig.title || "Wiki.js",
      releaseNotesDialog: false,
      releaseInfos: [],
      releaseNotesLoading: false,
      releaseNotesError: null,
      colors
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
    },
    releaseNotesCloseColor() {
      return this.$vuetify.theme.dark ? 
        '#ffffff' : 
        this.colors.surfaceLight.primaryBlueHeavy
    }
  },
  methods: {
    async openReleaseNotes() {
      this.releaseNotesDialog = true
      if (this.releaseInfos.length > 0 || this.releaseNotesLoading) { return }
      this.releaseNotesLoading = true
      this.releaseNotesError = null
      try {
        const { data } = await this.$apollo.query({
          query: releaseInfosQuery,
          fetchPolicy: 'network-only'
        })
        this.releaseInfos = (data.releaseInfos || []).map(ri => ({
          versionNumber: ri.versionNumber,
          releaseDate: ri.releaseDate,
          notes: ri.notes || []
        }))
      } catch (err) {
        this.releaseNotesError = err.message || 'Failed to load release notes.'
      } finally {
        this.releaseNotesLoading = false
      }
    },
    closeReleaseNotes() {
      this.releaseNotesDialog = false
    },
    localizeNote(note) {
      const lang = (siteConfig.lang || 'en').toLowerCase()
      if (lang.startsWith('de')) { return note.notesDe }
      return note.notesEn
    },
    formatDate(dateStr) {
      if (!dateStr) { return '' }
      try {
        const dt = new Date(dateStr)
        return dt.toLocaleDateString(siteConfig.lang || 'en', { year: 'numeric', month: 'short', day: '2-digit' })
      } catch (e) {
        return dateStr
      }
    }
  }
}
</script>

<style lang="scss">
  .v-footer.nav-footer {
    padding-right: 80px;
    padding-left: var(--sidebar-width, 300px);
    transition: padding-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    
    @media (max-width: 959px) {
      padding-left: 0 !important;
    }
    
    .footer-content {
      margin-left: 16px;
    }
  }
  
  .v-footer {
    a {
      text-decoration: none;
    }

    &.altbg {
      background: mc('surface-light', 'secondary-blue-heavy');

      span {
        color: mc('blue', '300');
      }

      a {
        color: mc('blue', '200');
      }
    }
    .release-notes-container {
      display: flex;
      justify-content: center;
      width: 100%;
      margin-top: 4px;
    }
    .release-notes-link {
      cursor: pointer;
      color: #2196f3;
      &:hover { text-decoration: underline; }
    }
    .release-info-block {
      .body-1 { 
        font-family: 'Ubuntu', sans-serif;
        font-weight: 700;
        font-size: 1.25rem;
      }
    }
    .release-notes-list {
      list-style-position: inside !important;
      text-align: left !important;
      padding-left: 0 !important;
      margin-left: 0 !important;
      li { 
        list-style: disc; 
        margin-bottom: 4px;
        font-family: 'Ubuntu', sans-serif;
        font-weight: 500;
        font-size: 1.125rem;
        text-align: left !important;
      }
    }
    
    .release-info-block:first-child {
      margin-top: 0;
    }
    
    .theme--light .release-info-block .body-1 {
      color: #565862;
    }
    .theme--light .release-notes-list li {
      color: #565862;
    }
    
    .theme--dark .release-info-block .body-1 {
      color: #c7c8cc;
    }
    .theme--dark .release-notes-list li {
      color: #565862;
    }
    
    .v-btn.rounded-button {
      border-radius: 20px;
    }
  }
  
  .v-dialog {
    .v-card {
      .v-card__text {
        padding-top: 24px !important;
        padding-bottom: 8px !important;
      }
      .v-card__actions {
        padding-top: 8px !important;
        padding-bottom: 16px !important;
      }
    }
  }
  
  .theme--dark .v-dialog .v-card {
    background-color: #1d1f29 !important;
    
    .v-card__actions {
      background-color: #272936 !important;
    }
  }
  
  .theme--light .v-dialog .v-card {
    .v-card__actions {
      background-color: #e0e0e0 !important;
    }
  }
  
  .v-dialog .v-btn.rounded-button {
    font-size: 1rem !important;
    padding: 8px 24px !important;
    height: 40px !important;
    font-weight: normal !important;
    text-transform: none !important;
  }
  
  .theme--dark .v-dialog .v-btn.rounded-button {
    color: #272936 !important;
  }
</style>
