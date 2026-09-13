<template>
  <!--
    `aria-orientation` is stated because the tabs are at the RIGHT end of the bar and the arrow keys
    below move along it -- a reader on a screen reader is told which way the strip runs rather than
    inferring it from where the labels landed.
  -->
  <div
    ref="listEl"
    class="page-view-tabs"
    role="tablist"
    aria-orientation="horizontal"
    @keydown="onKeydown">
    <button
      v-for="tab of tabs"
      :key="tab.name"
      type="button"
      role="tab"
      class="page-view-tab"
      :class="{ 'is-active': tab.name === modelValue }"
      :aria-selected="String(tab.name === modelValue)"
      :tabindex="tab.name === modelValue ? 0 : -1"
      @click="emit('update:modelValue', tab.name)">
      <w-icon :name="tab.icon" size="sm" />
      <span>{{ tab.label }}</span>
      <!-- -> Only once there is something to count: a zero beside the tab says the same thing the
              empty talk page does, and says it on every page of the wiki -->
      <span class="page-view-tab-count" v-if="tab.count > 0">{{ tab.count }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'

/**
 * Article / Talk, above the content of a page that has a discussion beside it.
 *
 * Its own strip rather than `WTabs`, which is a segmented control: a tinted track with the active
 * tab raised out of it as a pill, drawn wherever a caller puts it. What this location wants is the
 * opposite shape -- chrome flush to the top and sides of the article column, with the active tab cut
 * out of it in the article's own colour so the two read as one surface. A pill floating in padding
 * above the article says "a control", where this says "you are looking at one of these two".
 *
 * The tabs are at the RIGHT end: the article's first heading is what a reader is here for and it
 * starts at the left, so the switch stays out of the way of the column's own beginning.
 */
const props = defineProps({
  /** Which view is on screen: `article` or `talk`. */
  modelValue: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

// STORES

const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

const listEl = ref(null)

// COMPUTED

const tabs = computed(() => [
  {
    name: 'article',
    icon: 'la:file-alt',
    label: t('common.comments.tabArticle'),
    count: 0
  },
  {
    name: 'talk',
    icon: 'la:comments',
    label: t('common.comments.tabTalk'),
    /*
      The count the page came with, not the length of a list this strip does not have: the badge has
      to be there before the discussion is ever opened, which is the whole reason it rides along on
      the page payload.
    */
    count: pageStore.commentsCount
  }
])

// METHODS

/**
 * Arrow keys move between the tabs, which is what a tablist is expected to do. Selecting as it moves
 * (rather than requiring a second key) is the automatic-activation pattern, and is right here: both
 * views are already loaded, so arriving at one costs nothing.
 */
function onKeydown(ev) {
  const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' }
  const move = keys[ev.key]
  if (move === undefined) {
    return
  }
  const btns = [...listEl.value.querySelectorAll('[role="tab"]')]
  if (btns.length === 0) {
    return
  }
  ev.preventDefault()
  const at = btns.indexOf(document.activeElement)
  const next =
    move === 'first'
      ? 0
      : move === 'last'
        ? btns.length - 1
        : (Math.max(at, 0) + move + btns.length) % btns.length
  btns[next].focus()
  emit('update:modelValue', tabs.value[next].name)
}
</script>

<style lang="scss">
/*
  The strip itself: chrome, flush to the top and both sides of the article column, with nothing
  around it -- it is the lid of the column rather than something placed in it.

  Flat, in the contents column's own grey (`.page-sidebar` in `_page-chrome.scss`: `$grey-2` light,
  `$dark-5` dark). The two meet along the article's right-hand edge, so one value across both reads as
  a single piece of chrome bent round the top and the side of the column -- which is what a gradient
  could not do, matching the column beside it at one height and missing it everywhere else.

  The line along the bottom is a step further up the same greys than the gradient now starts at, which
  is what makes it read as the strip closing on itself rather than as a border drawn under it. It runs
  the full width and the unselected tabs run UNDER it: the line is their bottom edge, and a tab tucked
  beneath it is one that has not been opened. Only the selected tab is above the line -- it is the
  front edge of the article below, so nothing may be drawn across the join.
*/
.page-view-tabs {
  position: relative;
  display: flex;
  align-items: flex-end;
  /* -> Right-aligned: see the component note */
  justify-content: flex-end;
  gap: 2px;
  height: 44px;

  /*
    Shorter on a phone, along with the tabs themselves (see below): the strip is chrome above an
    article on a screen that has 800 pixels of height for all of it, and 44 of them spent on a switch
    between two views is a bar the reader has to scroll past before the page starts. The clearance
    above the tabs comes down with it -- 8px of gradient over a 44px strip reads as a strip with tabs
    cut out of it, and over a 36px one it reads as padding.
  */
  @media (max-width: $breakpoint-xs-max) {
    height: 36px;
  }
  /* -> Enough that the last tab's corner reads as a corner, and not so much that the strip stops
        being flush with the side */
  padding-right: 0.5rem;
  flex: none;

  /*
    The line, as an overlay rather than as a border on this box: a border would be laid out UNDER the
    tabs (they end where the content box does), and what is wanted is a line drawn OVER them, which
    only something painted later can be. Positioned, so it paints above the tabs, which are not --
    and the selected tab then takes a `z-index` of its own to come back out on top of it.

    A pseudo-element rather than markup because a `tablist` takes tabs as its children and a line is
    not one of them; this way there is nothing in the accessibility tree to hide from it again.
  */
  &::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    /*
      `--page-chrome-rule` is the edge this line belongs to, declared per theme on `.page-container`
      (`_page-chrome.scss`): the same value continues down the right-hand side of the article as
      `.page-article-col`, so the two are stated once and turn the corner together.
    */
    border-bottom: 1px solid var(--page-chrome-rule);
  }

  @at-root .body--light & {
    background-color: $grey-2;
  }
  @at-root .body--dark & {
    background-color: $dark-5;
  }
}

/*
  One tab, sitting on the bottom edge of the strip rather than filling it: the 8px of gradient left
  above is what makes the strip chrome that the tabs are cut out of, and it keeps every label down in
  the pale end of the ramp where it can be read.
*/
.page-view-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 36px;
  padding: 0 1rem;
  /* -> Top corners only: the bottom of a tab is not an edge, it is the article */
  border-radius: 6px 6px 0 0;
  /*
    Drawn on every tab and transparent until the tab is the selected one, rather than added to that
    one alone: the box is then the same size in both states, so no label shifts by a pixel as the
    strip is switched. None along the bottom in either state -- that edge is the strip's own line,
    which the selected tab is deliberately drawn over.
  */
  border: 1px solid transparent;
  border-bottom: 0;
  background-color: transparent;
  font-size: 0.8125rem;
  /* -> One weight for both states. What marks the selected tab out is the surface it is drawn in and
        the ink on it; setting the label heavier as well makes the strip twitch as it is switched,
        every label being a different width in the two states. */
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s var(--ease-standard),
    box-shadow 0.15s var(--ease-standard),
    color 0.15s var(--ease-standard);

  /*
    An unselected tab sits flat in the strip and is drawn by its label alone: what says it is a tab is
    the selected one beside it, which has a surface, an edge and a shadow, and the line along the
    bottom that it alone breaks. Nothing is spent on saying twice that the other tab is the other tab.

    Hover is then the only fill here, which is why it is a translucent black rather than a colour: it
    takes its shade from the strip behind it, so one value answers in both themes without either of
    them stating a second grey.
  */
  @at-root .body--light & {
    color: rgb(0 0 0 / 0.7);

    &:hover:not(.is-active) {
      background-color: rgb(0 0 0 / 0.09);
      color: rgb(0 0 0 / 0.9);
    }
  }
  @at-root .body--dark & {
    color: rgb(255 255 255 / 0.55);

    &:hover:not(.is-active) {
      background-color: rgb(0 0 0 / 0.3);
      color: rgb(255 255 255 / 0.85);
    }
  }

  /*
    The active tab is the article: the surface it is drawn in is the one the column is drawn in, so
    the two meet with nothing between them and the tab reads as the front edge of what is below.

    Which is why these are the document's own background values rather than a token -- `body` is what
    paints the article column, and this is that same fill brought up 36px into the chrome.

    Its three sides carry the strip's own line colour, so the line the tab interrupts turns the corner
    and goes round it: what is drawn is one continuous edge with a tab raised out of it.
  */
  &.is-active {
    /* -> Above the line that crosses every other tab; see the strip's `::after` */
    position: relative;
    z-index: 1;
    /*
      Lifted out of the strip, and cut off flat where it meets the article: a shadow that reached past
      the bottom edge would be drawn ON the content, and the join between the two has to be nothing at
      all -- that is the whole of what makes the tab and the article one surface.

      `clip-path` rather than a shadow shaped to fall short of the edge, because no offset and blur
      can promise that: the clip region is grown past the top and the sides, where the shadow is
      wanted, and cut exactly at the bottom, where it is not.
    */
    box-shadow: 0 -2px 6px rgb(0 0 0 / 0.09);
    clip-path: inset(-8px -8px 0);
    /* -> The strip's own line, carried round the three sides the tab shows; see its `::after` */
    border-color: var(--page-chrome-rule);
    /*
      A little light along the top, falling away to nothing by the bottom: the tab keeps the article's
      exact colour where the two meet -- which is the whole of the merge -- and lifts away from it as
      it rises out of the strip.

      A white wash over whatever `background-color` the theme set, rather than a gradient stated twice
      in the two themes' own values: it says "this colour, a little lighter at the top" once, and each
      theme keeps one statement of what the article's surface is. In the light theme that surface is
      already white and there is nowhere lighter to go, so the wash is invisible there and the tab
      stays flat -- which is correct rather than a shortcoming, white being the end of the ramp.
    */
    background-image: linear-gradient(to bottom, rgb(255 255 255 / 0.06) 0%, transparent 100%);

    @at-root .body--light & {
      background-color: #fff;
      color: $grey-9;
    }
    @at-root .body--dark & {
      background-color: $dark-6;
      color: #fff;
      /* -> Harder, because a soft black on a dark strip is nothing at all */
      box-shadow: 0 -2px 6px rgb(0 0 0 / 0.4);
    }
  }

  /* -> The strip is a small target on a phone and the labels are what make it one; the icons go
        rather than the words */
  @media (max-width: $breakpoint-xs-max) {
    /* -> 32px in a 36px strip, which keeps the 4px of chrome above that makes it a strip. Under the
          44px a touch target is usually drawn to, deliberately: what is being tapped is a full-width
          label in a bar with nothing else in it, not a control with neighbours to hit by mistake. */
    height: 32px;
    padding: 0 0.75rem;

    .w-icon {
      display: none;
    }
  }
}

/*
  The count, which belongs to the tab rather than to the strip: it is primary in both themes and on
  both states, so it reads the same whether the discussion is open or not.
*/
.page-view-tab-count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background-color: $primary;
  color: #fff;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  /*
    A little of its own colour cast around it, which is what makes a count of something WAITING read
    as one -- the same trick `_page-contents.scss` uses for a step's glow, and the same way of writing
    it (`color-mix` to an alpha rather than a second blue to keep in step with the first).

    Static, not a pulse: the number is there on every page of the wiki that has a discussion, and a
    thing that moves in the corner of the eye all day is a thing a reader learns to look away from.

    It stays inside the tab: the glow is 6px on a badge with 8px of tab below it, so the selected
    tab's `clip-path` -- which cuts everything at the join with the article -- never reaches it.
  */
  box-shadow: 0 0 6px color-mix(in srgb, $primary 50%, transparent);

  /* -> Further on a dark ground, where a glow has somewhere to fall */
  @at-root .body--dark & {
    box-shadow: 0 0 8px color-mix(in srgb, $primary 65%, transparent);
  }
}
</style>
