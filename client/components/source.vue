<template lang='pug'>
  v-app(:dark='$vuetify.theme.dark').source
    nav-header
    v-content
      v-toolbar(:color='$vuetify.theme.dark ? colors.surfaceDark.primaryBlueHeavy : colors.surfaceLight.primaryBlueHeavy')
        span(:style='{"color": colors.textDark.primary}')
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
          v-btn#return-btn.ml-4(
            depressed
            rounded
            :class='$vuetify.theme.dark ? `theme--dark` : ``'
            @click='goLive'
            )
            span {{$t('common:page.returnNormalView')}}
      v-card(
        tile
        :color='$vuetify.theme.dark ? colors.borderDark.secondary : colors.borderLight.secondary'
        )
        v-card-text
          v-card.radius-7(
            flat
            :color='$vuetify.theme.dark ? colors.surfaceDark.black : colors.surfaceLight.white'
            )
            v-card-text
              pre
                slot

    nav-footer
    notify
    search-results
</template>

<script>
import colors from '@/themes/default/js/color-scheme'

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
    },
    effectivePermissions: {
      type: String,
      default: ''
    },
    sitePath: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      colors: colors
    }
  },
  created () {
    this.$store.commit('page/SET_ID', this.pageId)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'source')

    if (this.effectivePermissions) {
      this.$store.set('page/effectivePermissions', JSON.parse(Buffer.from(this.effectivePermissions, 'base64').toString()))
    }
  },
  methods: {
    goLive() {
      window.location.assign(`/${this.sitePath}/${this.locale}/${this.path}`)
    },
    goHistory () {
      window.location.assign(`/h/${this.sitePath}/${this.locale}/${this.path}`)
    }
  }
}
</script>

<style lang='scss' scoped>
#return-btn {
  background-color: mc('action-light', 'active') !important;
  &> ::v-deep span {
    color: mc('text-dark', 'primary')
  }
  &:hover {
    background-color: mc('action-light', 'primary-hover-on-heavy') !important;
    &> ::v-deep span {
      color: mc('text-light', 'brand-primary')
    }
  }

  &.theme--dark {
    background-color: mc('action-dark', 'active') !important;
    &> ::v-deep span {
      color: mc('text-light', 'brand-primary')
    }
    &:hover {
      background-color: mc('action-dark', 'primary-hover-on-heavy') !important;
    }
  }
}
</style>

<style lang='scss'>

.source {

  pre {
    overflow: auto;
    height: calc(100vh - 278px);

    &> code {
      box-shadow: none;
      background-color: mc('surface-light', 'white');
      color: mc('text-light', 'primary');
      font-family: 'Ubuntu Mono', sans-serif;
      font-weight: 400;
      font-size: 1rem;

      @at-root .theme--dark.source pre > code {
        background-color: mc('surface-dark', 'black');
        color: mc('text-dark', 'primary');
      }

      &::before {
        display: none;
      }
    }
  }
}

</style>
<style lang='scss'>
// Styles moved from main page component for unfollow/follow button hover behavior
.v-btn.hover-btn {
  &:hover {
    background-color: mc('action-dark', 'highlight-on-lite') !important;
  }
}

.v-btn.border-btn {
  border: 1px solid mc('border-light', 'primary') !important;
  box-shadow: none !important;

  &.hover-btn:hover {
    background-color: mc('teal', '800') !important;
    border: 1px solid mc('teal', '800') !important;

    .v-icon {
      color: mc('surface-light', 'white') !important;
    }

    &.delete-btn {
      background-color: mc('warning-action-light', 'secondary-default') !important;
      border: 1px solid mc('warning-action-light', 'secondary-default') !important;

      .v-icon {
        color: mc('action-light', 'content-white') !important;
      }
    }

    &.dark {
      background-color: mc('teal', '500') !important;
      border: 1px solid mc('teal', '500') !important;

      .v-icon {
        color: mc('action-dark', 'content-on-lite') !important;
      }

      &.delete-btn {
        background-color: mc('warning-action-dark', 'secondary-default') !important;
        border: 1px solid mc('warning-action-dark', 'secondary-default') !important;

        .v-icon {
          color: mc('action-dark', 'content-on-lite') !important;
        }
      }
    }
  }

  &.theme--dark {
    border: 1px solid mc('border-dark', 'primary') !important;

    &.hover-btn:hover {
      background-color: mc('action-dark', 'highlight-on-lite') !important;
      border: 1px solid mc('action-dark', 'highlight-on-lite') !important;

      .v-icon {
        color: mc('action-dark', 'content-on-lite') !important;
      }
    }
  }
}
</style>
