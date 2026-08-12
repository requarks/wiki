<template>
  <!-- -> The dent marking the current page is cut out of the edge FACING the content, which is the
          right one only while the sidebar is on the left; see the stylesheet -->
  <w-scroll-area
    class="sidebar-nav"
    :class="siteStore.theme.sidebarPosition === `right` ? `sidebar-nav--flipped` : ``"
    :thumb-style="thumbStyle"
    :bar-style="barStyle">
    <w-list class="sidebar-nav-list" clickable dense dark>
      <template v-for="item of siteStore.nav.items" :key="item.id">
        <w-item-label
          class="sidebar-nav-header text-caption text-wordbreak-all"
          v-if="item.type === `header`"
          header
          >{{ item.label }}</w-item-label
        >
        <!-- -> Open from the start when the page being read is one of its children, so a reader arriving
                by URL sees where they are in the tree. Not `v-model`: after that first render the group
                is the reader's to open and close, and a bound value would fight them -->
        <w-expansion-item
          v-else-if="item.type === `link` && item.children?.length > 0"
          dense
          :default-opened="containsCurrent(item)">
          <!-- The icon goes through a header slot rather than the `icon` prop, so that an Iconify -->
          <!-- reference is drawn by w-icon like everywhere else -->
          <template #header>
            <w-item-section side><w-icon :name="item.icon" color="white" /></w-item-section>
            <w-item-section class="text-wordbreak-all text-white">{{ item.label }}</w-item-section>
          </template>
          <w-list clickable dense dark>
            <w-item
              v-for="itemChild of item.children"
              v-bind="destination(itemChild)"
              :key="itemChild.id">
              <w-item-section side><w-icon :name="itemChild.icon" color="white" /></w-item-section>
              <w-item-section class="text-wordbreak-all text-white">{{
                itemChild.label
              }}</w-item-section>
            </w-item>
          </w-list>
        </w-expansion-item>
        <w-item v-else-if="item.type === `link`" v-bind="destination(item)">
          <w-item-section side><w-icon :name="item.icon" color="white" /></w-item-section>
          <w-item-section class="text-wordbreak-all text-white">{{ item.label }}</w-item-section>
        </w-item>
        <w-separator v-else-if="item.type === `separator`" dark />
      </template>
    </w-list>
  </w-scroll-area>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { routableHref } from '@/helpers/renderedContent'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.1
}

// METHODS

/**
 * Where a nav item points, as the props that take a reader there.
 *
 * An administrator types this address by hand and it can be anything: a path in this wiki, a URL on
 * another site, a `mailto:`. Only the first of those is the router's, and handing it the others is what
 * made an external link land on "This page does not exist yet" -- vue-router matched
 * `https://example.com/x` as a PATH, found nothing, and fell through to the catch-all page view.
 *
 * The question is the one `routableHref` already answers for the links inside a rendered page, so it is
 * the same function that answers it here rather than a second opinion that can drift from it. Which also
 * settles two cases beyond the reported one: an item pointing into `/_files/` now downloads the file
 * instead of 404ing, and one pointing at `#a-heading` on this page jumps to it.
 *
 * `openInNewWindow`, set per link in the navigation editor, is fed into the same question rather than
 * added on afterwards: a link asking for a new tab is one `routableHref` declines whatever it points at,
 * on the grounds that a new context is the browser's to open and not the router's to swap in. So such an
 * item goes out as a plain anchor -- which loads this app fresh in the new tab, which is what a new tab
 * does in any case.
 *
 * Mind the two meanings of "target" in here: a nav item's is the address to go to, an anchor's is the
 * window to open it in.
 */
function destination(item) {
  const address = item.target ?? '/'
  const target = item.openInNewWindow ? '_blank' : undefined
  let routable = null
  try {
    routable = routableHref(
      { href: new URL(address, globalThis.location.href).href, target },
      globalThis.location
    )
  } catch {
    // -> Not a URL at all: nothing to route to, so it goes out as the author wrote it
  }
  return routable ? { to: routable } : { href: address, target }
}

/**
 * Whether a nav item points at the page being read.
 *
 * Only a routed item can be: an address that leaves the wiki is never where the reader already is, and
 * one that opens in a new tab is not asking to be here either. Asked of the router rather than compared
 * as strings, so a trailing slash, an escape or a redirect is settled the same way the router settles it
 * when the reader actually clicks.
 *
 * This is only used to decide which groups open on arrival. The dent itself is drawn off
 * `router-link-exact-active`, the class `RouterLink` puts on the row it has taken the reader to -- the
 * same question, answered by the same router, but kept up to date by the link itself as the reader moves
 * around rather than recomputed here.
 */
function isCurrent(item) {
  const { to } = destination(item)
  return Boolean(to) && router.resolve(to).path === route.path
}

/** ...and whether one of a group's children is, which is what opens the group. */
function containsCurrent(item) {
  return (item.children ?? []).some((child) => isCurrent(child))
}

// WATCHERS

watch(
  () => pageStore.navigationId,
  (newValue) => {
    if (newValue && newValue !== siteStore.nav.currentId) {
      siteStore.fetchNavigation(newValue)
    }
  },
  { immediate: true }
)
</script>

<style lang="scss">
.sidebar-nav {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  /* -> Fills whatever the drawer's flex column has left over, rather than subtracting the action bar
     and footer bar by hand: both are conditional, so a fixed `calc()` left dead space at the bottom
     for an anonymous reader (no footer bar) and for a site with no action bar at all. `min-height: 0`
     is what lets it shrink below its content so the scroll area actually scrolls. */
  flex: 1 1 0;
  min-height: 0;

  &-list > .w-separator {
    margin-top: 10px;
    margin-bottom: 10px;
  }

  /*
    A first item that is a link -- on its own or as a group with children -- needs the space a first
    header brings with it. A dense row's padding is 2px, so its label started hard against the rule under
    the site header; a header's own `p-4` already stands it 16px clear, which is why this is only for the
    two link shapes and not for every first child.
  */
  &-list > .w-item:first-child,
  &-list > .w-expansion-item:first-child {
    margin-top: 10px;
  }

  .w-list {
    .w-separator + .w-item-label {
      padding-top: 10px;
    }

    /* -> Full white, like the icons and labels this sidebar sets by hand: the chevron is what says the
       row opens, so it is not the secondary content a trailing section is dimmed for. Set on the icon
       rather than on its section, which is what makes it beat the inherited dimmed colour. */
    .w-expansion-item__arrow {
      color: #fff;
    }

    .w-item-section--avatar {
      min-width: auto;
    }

    /*
      The row holding the page being read, marked by a notch bitten out of the sidebar's inner edge.

      Painted in the colour of what is on the other side of that edge -- the page itself, which is the
      body's own background, since nothing between here and the article column paints one. So it is not a
      marker drawn ON the sidebar but a piece of the sidebar missing, with the content showing through.

      `router-link-exact-active` is `RouterLink`'s own, so the mark follows the reader without this
      component tracking anything: a row rendered as a plain `<a>` -- an address that leaves the wiki or
      opens in a new tab -- never carries it, which is right, because a reader is never already there.
    */
    .w-item.router-link-exact-active {
      position: relative;

      /*
        A triangle out of one border: the right border is the only one with a colour, and the left has no
        width, so the shape tapers to a point on the left. Flush to the edge and centred on the row.
      */
      &::after {
        content: '';
        position: absolute;
        top: 50%;
        right: 0;
        width: 0;
        height: 0;
        transform: translateY(-50%);
        border-style: solid;
        border-width: 7px 7px 7px 0;
        border-color: transparent #fff transparent transparent;

        @at-root .body--dark & {
          border-color: transparent $dark-6 transparent transparent;
        }
      }
    }

    /*
      An open group's children, marked the way `NavEditOverlay` marks a nested nav item: a 10px rule down
      the side of the run, with an elbow at each end turning it out of the row above and closing it under
      the last child. The same three pieces and the same 10px, so the two views of one navigation tree
      look like the same tree.

      The rules this replaces addressed `.q-expansion-item__container` and `.q-expansion-item--expanded`,
      which is markup `WExpansionItem` has never emitted -- it renders `__header` and `__content` and
      keeps its state in `aria-expanded`. So none of them matched, and an open group had no line at all.

      No expanded/collapsed state needed here: the content is `v-show`n, so when the group is closed this
      box is `display: none` and takes its border and both elbows with it.
    */
    .w-expansion-item__content {
      position: relative;
      border-left: 10px solid rgba(255, 255, 255, 0.25);
      /*
        And a step DOWN from the sidebar rather than up, which is the one place this parts company with
        `NavEditOverlay`: there the nested rows lift off a near-black panel, here they sit in a coloured
        one, and a lighter wash on a mid-tone blue reads as a highlight -- as if the whole group were
        selected.

        A translucent black, not a colour: the sidebar's own is the site's to choose (`--q-sidebar`,
        rewritten at runtime for per-site theming), so anything fixed would be right for the default blue
        and wrong for every other site.

        `padding-box` keeps that wash off the border area. The rule there is 25% white, and with the
        default `border-box` clip the darkened wash behind it would leave the rule a different colour
        along the children than at the two elbows, which have nothing behind them.
      */
      background-color: rgb(0 0 0 / 0.12);
      background-clip: padding-box;

      /*
        Each elbow is one 10px box showing two of its borders: the mitre between them is the angle. Set
        10px outside the content on the appropriate side, so the vertical stroke lines up with the rule
        and continues it. `left: -10px` is the rule's own left edge -- an absolute offset here is
        measured from the padding box, which starts where the border ends.
      */
      &::before,
      &::after {
        content: '';
        display: block;
        position: absolute;
        left: -10px;
        width: 10px;
        height: 10px;
        border-style: solid;
      }

      /* -> Out of the parent row: the rule's top end, turning right into the row above it */
      &::before {
        top: -10px;
        border-width: 0 10px 10px 0;
        border-color: transparent transparent rgba(255, 255, 255, 0.25) rgba(255, 255, 255, 0.25);
      }

      /* -> And closed under the last child, turning right again */
      &::after {
        top: 100%;
        border-width: 10px 10px 10px 0;
        border-color: rgba(255, 255, 255, 0.25) transparent transparent rgba(255, 255, 255, 0.25);
      }
    }
  }

  /*
    A site can put this sidebar on the right instead, which puts the page on the other side of it: the
    notch has to be bitten out of the left edge then, and point the other way, or it is a white arrow at
    the window's edge pointing at nothing.

    Same specificity as the rule it overrides and stated after it, so the sides swap cleanly.
  */
  &--flipped .w-list .w-item.router-link-exact-active::after {
    right: auto;
    left: 0;
    border-width: 7px 0 7px 7px;
    border-color: transparent transparent transparent #fff;

    @at-root .body--dark & {
      border-color: transparent transparent transparent $dark-6;
    }
  }

  /*
    A child row starts 10px in, past the rule that marks the group -- and on this side that is the edge
    the notch is cut from, so it would be bitten out of the middle of the sidebar with a strip of colour
    still outside it. Pushed back out to where the sidebar itself ends.

    The other way round this does not arise: with the sidebar on the left the notch is on the right edge,
    and only the left of a child row is indented.
  */
  &--flipped .w-list .w-expansion-item__content .w-item.router-link-exact-active::after {
    left: -10px;
  }

  &-header {
    color: rgba(255, 255, 255, 0.75) !important;
    /* -> WItemLabel's uniform `p-4` leaves the heading floating between its own group and the one
       above it; tightening the bottom side ties it to the links it labels */
    padding-bottom: 4px;
  }
}
</style>
