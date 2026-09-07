<template>
  <div class="page-header flex flex-wrap">
    <!-- PAGE ICON -->
    <!--
      Never a button, unlike `PageHeader`'s: there is no editing surface on a snapshot, so the icon is
      the drawing and nothing else. Same size and same column so the two headers line up exactly --
      walking from a page to one of its versions should move the title bar's contents nowhere.
    -->
    <div class="flex-none pl-4 flex items-center">
      <w-icon class="rounded" :name="icon" :size="iconSize" color="primary" />
    </div>
    <!-- PAGE HEADING -->
    <!--
      Centred rather than top-aligned, as in `PageHeader`: with no description the title is the only
      line in this column and would otherwise sit above the middle of the icon beside it.
    -->
    <div class="min-w-0 flex-1 flex flex-col justify-center p-2 sm:p-4">
      <div class="text-h4 page-header-title">{{ title }}</div>
      <div class="text-subtitle2 page-header-subtitle">{{ description }}</div>
    </div>
    <!-- VERSION ACTIONS -->
    <!--
      What this header has in place of Watch / Print / Edit: the three things there are to do with a
      snapshot, and Print, which is the one button from that row meaning the same thing here. Two of
      the three are icons -- taking a copy of the version, in either of two forms -- and the third is
      labelled, because it is the one that WRITES, and a button that overwrites the live page should
      not be a glyph somebody presses to find out what it does. Its ellipsis is doing the same work:
      restoring asks first.

      Download, Restore and Branch off each do the same as their entry in the history overlay's version
      menu, through the same code. Print is `PageHeader`'s own button -- the same icon, the same site
      setting behind it and the same one-line call -- because a snapshot goes on paper exactly as a page
      does, and `css/_print.scss` keeps this bar on the sheet so the printout says which version it was.

      Restore is the only one that WRITES to the live page, which is why it keeps the orange this app
      gives an action that changes a page, and why it asks before doing it. Branch off creates a page
      instead of overwriting one, so it sits with the harmless ones.

      They stay on a phone, where `PageHeader` drops its whole row: that row is icons for things
      reachable elsewhere -- Print is the browser's own menu -- while these are the only actions this
      view offers at all, so hiding them would leave the screen with none. Print rides along with them
      rather than being kept for its own sake; it is one glyph in a row that has to be there anyway.

      What they do instead is take a row of their own, which is what `w-full` at phone widths buys: the
      bar already wraps, but this block is `flex-none` and about 230px wide, so beside a 32px icon it
      left the title column ~60px and the description came out one word per line. Full width wraps it
      under the title, and `.page-header` is `height: auto` on the same breakpoint so the bar grows by
      the row rather than squeezing it.
    -->
    <!--
      `ml-2` throughout, which is the editor's own action row (see `PageHeader`): 8px between buttons
      rather than 16. Every one of them is acrylic and flat there too, except View Live, which is the
      one filled button -- see its own note below.

      The icon-only pair takes the same treatment as View Documentation in that row: acrylic, flat,
      grey, and NOT `dense`, so a glyph-only button is the same height as the labelled ones beside it
      instead of a smaller target floating in the middle of them.
    -->
    <div
      class="page-header-actions w-full sm:w-auto flex-none px-4 pb-4 sm:p-4 flex items-center justify-end">
      <w-btn
        class="acrylic-btn ml-2"
        flat
        icon="la:download"
        color="grey"
        :aria-label="t(`history.downloadVersion`)"
        @click="emit(`download`)">
        <w-tooltip>{{ t('history.downloadVersion') }}</w-tooltip>
      </w-btn>
      <!--
        On the site's own Print Button setting, as the page header's is: an administrator who has turned
        it off has said the wiki does not offer one, and a version of a page is not the exception to
        that.
      -->
      <w-btn
        class="acrylic-btn ml-2"
        v-if="siteStore.theme.showPrintBtn"
        flat
        icon="la:print"
        color="grey"
        :aria-label="t(`common.actions.print`)"
        @click="printPage">
        <w-tooltip>{{ t('common.actions.print') }}</w-tooltip>
      </w-btn>
      <!--
        Branch off before Restore: it reads as the gentler of the two, and Restore stays next to the
        confirmation it raises.

        Indigo, which is the colour this app gives history -- the Schedule tab's calendar, the version
        timeline's dots, the bar at the top of this very screen. It also tells this button apart from
        the grey pair beside it, which a third grey button did not.

        Two shades, because one will not do: as a LABEL, `indigo` measures 6.3:1 on the light header
        and 2.5:1 on the dark one, while `indigo-4` is 5.0:1 dark and 3.2:1 light. So each theme takes
        the shade that is legible in it. Bound rather than left to a `dark:` class because `WBtn`
        writes the colour as an inline style (`--w-btn-color`, and `color` with it), which no
        stylesheet outranks without `!important`.
      -->
      <w-btn
        class="acrylic-btn ml-2"
        flat
        icon="la:code-branch"
        :color="dark.isActive ? `indigo-4` : `indigo`"
        no-caps
        :label="t(`history.branchOffShort`)"
        :aria-label="t(`history.branchOffShort`)"
        @click="emit(`branch`)" />
      <!-- -> The same orange every page header gives the action that changes the page -->
      <w-btn
        class="acrylic-btn ml-2"
        flat
        icon="la:undo"
        color="deep-orange-9"
        no-caps
        :label="t(`history.restore`)"
        :aria-label="t(`history.restore`)"
        @click="emit(`restore`)" />
      <!--
        The one live control on this row, and the only way out of the snapshot that does not go
        backwards: everything else here acts on the version, while this leaves it for the page as it
        stands. In the site's own colour rather than the orange beside it, because it is not a change
        to anything -- it is navigation.

        A `to`, not a click handler: it is a link to a path, so it should behave like one — middle-click
        and ctrl-click open the live page in a tab, and the status bar shows where it goes.

        Solid rather than acrylic, and the only filled button in the row: it is where a reader goes
        when they are done here, so it carries the weight. `unelevated` because that is how this app
        does a solid primary button everywhere else -- the unlock and create buttons in `Index.vue`
        -- and a raised one would be the only shadow in a flat header.

        No `acrylic-btn`, which paints a 10% tint of the button colour and would be a second, weaker
        background under the fill. And no `dark:` variant either: `primary-light` is right for
        primary as TEXT on a dark page, but as a FILL behind white it measures 2.4:1 where plain
        `primary` gives 4.6:1. A fill carries its own contrast, so one colour serves both themes.

        Rendered only with a path to go to. In practice there is always one, since the endpoint behind
        this view refuses a version whose page has been deleted (page rules need a page to be checked
        against), but a button whose target is empty would navigate to the site root and quietly look
        like it had worked.
      -->
      <w-btn
        class="ml-2"
        v-if="livePath"
        unelevated
        icon="la:eye"
        color="primary"
        no-caps
        :to="livePath"
        :label="t(`history.viewLive`)"
        :aria-label="t(`history.viewLive`)" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { useMinWidth } from '@/composables/screen'

import { useSiteStore } from '@/stores/site'

const emit = defineEmits(['download', 'restore', 'branch'])

defineProps({
  /** The page's icon as the version recorded it, an Iconify reference. */
  icon: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  /**
   * Where the live page sits now, ready to route to — locale prefix and all. Empty when there is
   * nowhere to send the reader, which hides the View Live button rather than pointing it at nothing.
   */
  livePath: {
    type: String,
    default: ''
  }
})

// STORES

const siteStore = useSiteStore()

// COMPOSABLES

const dark = useDark()

// I18N

const { t } = useI18n()

// COMPUTED

/**
 * The page icon, halved on a phone — the same call, and the same reason, as `PageHeader`: `WIcon`
 * renders `size` as an inline `font-size`, which no stylesheet can outrank without `!important`, so it
 * has to be bound rather than left to a media query.
 */
const isAtLeastSm = useMinWidth(600)
const iconSize = computed(() => (isAtLeastSm.value ? '64px' : '32px'))

// METHODS

/**
 * Hand the snapshot to the browser's print dialog.
 *
 * Here rather than emitted to `PageVersion.vue`, unlike every other button in this header: those three
 * act on the VERSION and go through the API helpers the history overlay uses, so the parent owns them.
 * This one acts on the window and knows nothing about what is in it -- the same call `PageHeader` makes
 * for a live page, and what it prints is decided entirely by `css/_print.scss`.
 */
function printPage() {
  window.print()
}
</script>
