<template lang="pug">
q-footer.site-footer
  .site-footer-line
    i18n-t.q-mr-xs(
      v-if='hasSiteFooter'
      :keypath='isCopyright ? `common.footerCopyright` : `common.footerLicense`'
      tag='span'
      )
      template(#company)
        strong {{siteStore.company}}
      template(#year)
        span {{currentYear}}
      template(#license)
        span {{t(`common.license.` + siteStore.contentLicense)}}
    i18n-t(
      :keypath='props.generic ? `common.footerGeneric` : `common.footerPoweredBy`'
      tag='span'
      )
      template(#link)
        a(href='https://js.wiki', target='_blank', ref='noopener noreferrer'): strong Wiki.js
  .site-footer-line(v-if='!props.generic && siteStore.footerExtra')
    span {{ siteStore.footerExtra }}
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from 'src/stores/site'

// PROPS

const props = defineProps({
  generic: {
    type: Boolean,
    default: false
  }
})

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const currentYear = new Date().getFullYear()

// COMPUTED

const hasSiteFooter = computed(() => {
  return !props.generic && siteStore.company && siteStore.contentLicense
})
const isCopyright = computed(() => {
  return siteStore.contentLicense === 'alr'
})
</script>

<style lang="scss">
.site-footer {
  background-color: $grey-3;
  color: $grey-8;
  padding: 4px 12px;
  font-size: 11px;

  &-line {
    text-align: center;

    a {
      text-decoration: none;
      color: inherit;

      &:hover, &:focus {
        text-decoration: underline;
      }
    }

    & + .q-bar {
      height: 18px;
    }
  }
}
</style>
