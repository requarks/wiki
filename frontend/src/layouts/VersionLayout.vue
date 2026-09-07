<template>
  <w-layout>
    <w-header class="site-header-wrap">
      <header-nav />
    </w-header>
    <!--
      No `<w-drawer>`, which is the whole of what separates this from `MainLayout`: a snapshot is
      reached from a link rather than browsed to, and the navigation tree is about where pages are NOW
      -- every entry in it would lead out of the version being read without saying so.

      What follows from that is the simple part of this file. There is no sidebar, so there is no
      opener for one on a narrow viewport, and no column for scroll-to-top to end at: it sits in the
      corner at every width, which is the `scrollerAnchorX: null` case `MainLayout` reaches when a site
      has its sidebar off.
    -->
    <!--
      No `<w-footer>` here, for the same reason as `MainLayout`: this shell holds still and the article
      column scrolls inside it, so a footer at this level would be pinned to the window. The version
      view puts one at the end of that scrolling column instead.
    -->
    <w-page-container>
      <router-view />
      <!--
        Below 750px the version view turns its contents column into a panel and takes this corner for
        the opener, exactly as the page view does -- so this stands down there, and the two never
        overlap. `.page-container-scrl` is the article column, which is what actually scrolls.
      -->
      <w-page-scroller
        v-if="isAtLeastTocPanelWidth"
        :scroll-offset="150"
        :anchor-x="null"
        target=".page-container-scrl">
        <w-btn
          class="corner-btn corner-btn--right"
          icon="la:arrow-up"
          color="primary"
          round
          size="md" />
      </w-page-scroller>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useMinWidth } from '@/composables/screen'
import { useMeta } from '@/composables/meta'

import { useSiteStore } from '@/stores/site'

// COMPONENTS

import HeaderNav from '@/components/HeaderNav.vue'

// STORES

const siteStore = useSiteStore()

// META

/*
  The same title template as `MainLayout`, and a getter for the same reason: the site config is
  fetched, so a template closing over `siteStore.title` and registered once would keep whatever the
  store held at mount. The version view supplies the title half.
*/
useMeta(() => {
  const siteTitle = siteStore.title
  return {
    titleTemplate: (title) => (title ? `${title} - ${siteTitle}` : siteTitle)
  }
})

// COMPUTED

/**
 * At or above 750px, which is where scroll-to-top keeps the bottom-right corner. Below it the version
 * view turns its contents column into a panel and puts that panel's opener here instead. The view owns
 * the threshold (`$toc-overlay-max` and the 750px `useMinWidth` in `pages/PageVersion.vue`); this is
 * the same number from the side that has to get out of the way.
 */
const isAtLeastTocPanelWidth = useMinWidth(750)
</script>

<style lang="scss">
/*
  The window behind the shell, in the dark theme.

  Every layout that holds a page-shaped view declares this for itself -- `MainLayout`, `InboxLayout`
  and `ProfileLayout` all carry the identical rule -- because it paints `body`, which is outside the
  app's own markup and so cannot be reached by anything scoped. Without it the article column sits on
  the browser's default white while the header, the contents column and the footer are all dark, and
  the body text, which IS white in that theme, disappears into it.
*/
body.body--dark {
  background-color: $dark-6;
}
</style>
