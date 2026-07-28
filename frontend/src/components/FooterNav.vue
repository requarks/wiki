<template>
  <div class="site-footer">
    <div class="site-footer-line">
      <i18n-t
        v-if="hasSiteFooter"
        class="mr-1"
        :keypath="isCopyright ? `common.footerCopyright` : `common.footerLicense`"
        tag="span"
        scope="global">
        <template #company>
          <strong>{{ siteStore.company }}</strong>
        </template>
        <template #year>
          <span>{{ currentYear }}</span>
        </template>
        <template #license>
          <span>{{ t(`common.license.` + siteStore.contentLicense) }}</span>
        </template>
      </i18n-t>
      <i18n-t
        :keypath="props.generic ? `common.footerGeneric` : `common.footerPoweredBy`"
        tag="span"
        scope="global">
        <template #link>
          <a href="https://js.wiki" target="_blank" rel="noopener noreferrer"
            ><strong>Wiki.js</strong></a
          >
        </template>
      </i18n-t>
    </div>
    <div v-if="!props.generic && siteStore.footerExtra" class="site-footer-line">
      <span>{{ siteStore.footerExtra }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from '@/stores/site'

/**
 * Footer content.
 *
 * Content only: the enclosing layout supplies the footer element itself (`<w-footer>`, or
 * `<q-footer>` in a layout not yet migrated). Keeping positioning out of here is what lets the
 * three layouts sharing this component migrate one at a time instead of all together.
 */

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

<style scoped>
.site-footer {
  background-color: var(--color-grey-3);
  color: var(--color-grey-8);
  padding: 4px 12px;
  font-size: 11px;
}

:global(body.body--dark .site-footer) {
  background-color: var(--color-dark-4);
  color: rgb(255 255 255 / 0.4);
}

.site-footer-line {
  text-align: center;
}

.site-footer-line a {
  text-decoration: none;
  color: inherit;
}

.site-footer-line a:hover,
.site-footer-line a:focus {
  text-decoration: underline;
}
</style>
