<template>
  <div class="page-blog">
    <!--
      The blog's own words, above the listing. Plain text, deliberately: the front page has no
      renderer and no editor for one -- see `helpers/pageBlog.js` -- so `white-space: pre-line` is
      what gives the author their paragraph breaks back without any of the rest of it.
    -->
    <p class="page-blog-intro" v-if="settings.intro">{{ settings.intro }}</p>
    <!--
      What the reader has narrowed the blog to, and the way back out of it. Only drawn once something
      is selected: an empty filter bar over an unfiltered blog is a control that does nothing.
    -->
    <div class="page-blog-filters" v-if="activeFilter">
      <w-icon name="la:filter" size="sm" />
      <span class="pl-2">{{ activeFilter }}</span>
      <w-btn
        class="ml-2"
        flat
        dense
        size="sm"
        no-caps
        icon="la:times"
        color="primary"
        :label="t(`common.blog.clearFilter`)"
        @click="clearFilter" />
    </div>
    <div class="page-blog-status" v-if="blogState.loading && !blogState.loaded">
      {{ t('common.blog.loading') }}
    </div>
    <div class="page-blog-status" v-else-if="blogState.failed">
      {{ t('common.blog.loadFailed') }}
    </div>
    <template v-else>
      <!--
        An empty blog is reported as an empty blog, and an empty FILTER as an empty filter: they are
        different situations and only one of them is something the reader did. The first is also where
        a blog whose posts have been moved out from under it ends up -- there is no row anywhere
        recording that, so naming the path is the only thing that makes it legible.
      -->
      <div class="page-blog-empty" v-if="blogState.posts.length < 1">
        <w-icon class="page-blog-empty-icon" name="la:newspaper" />
        <template v-if="activeFilter">
          <div class="text-h6">{{ t('common.blog.noMatches') }}</div>
          <w-btn
            class="mt-4"
            outline
            no-caps
            color="primary"
            padding="xs md"
            :label="t(`common.blog.clearFilter`)"
            @click="clearFilter" />
        </template>
        <template v-else>
          <div class="text-h6">{{ t('common.blog.empty') }}</div>
          <div class="text-body2 mt-1 opacity-60">
            {{ t('common.blog.emptyHint', { path: `/${pageStore.path}/` }) }}
          </div>
          <!--
            The way out of an empty blog, for whoever can take it. Under the sentence that says what
            a post IS, because it is that sentence acted on: the menu writes the new page under this
            blog's path, which is the whole of what makes it a post.

            Only under the empty BLOG. The filtered branch above is empty because of something the
            reader did, and the answer there is to undo it rather than to write a post.
          -->
          <w-btn
            class="mt-6"
            v-if="canWriteHere"
            unelevated
            no-caps
            icon="la:plus"
            color="primary"
            padding="xs md"
            :label="t(`common.blog.newPost`)">
            <!--
              What a post may be written with: the editors that author an ARTICLE, which is what a
              post is. Not `redirect` and not `blog` — both write a page with no body, and
              `models/blogs.ts` does not count either as a post, so creating one here would add
              nothing to this listing. Read from the store rather than listed here, because the
              same partition decides where `PageNewMenu` draws its divider and because a list
              written out again is one that can fall behind an editor being added.
            -->
            <page-new-menu
              hide-asset-btn
              :only="siteStore.articleEditors"
              :base-path="pageStore.path" />
          </w-btn>
        </template>
      </div>
      <template v-else>
        <div class="page-blog-list" :class="`is-` + settings.layout">
          <router-link
            class="page-blog-post"
            v-for="(post, index) of blogState.posts"
            :key="post.id"
            :to="postLink(post)">
            <!--
              The card's lid: a band of brand colour across the top of it, holding the post's icon.
              One element for both layouts rather than two -- in `list` it is `display: contents` and
              leaves the layout entirely, so the icon is the flex item beside the text it always was.

              It goes with the icon rather than standing on its own, since a band whose only content
              is switched off is a stripe of colour saying nothing.
            -->
            <span class="page-blog-post-media" v-if="settings.show.icon">
              <!-- -> The size is a prop rather than a class: `WIcon` writes it as an inline style,
                      which beats anything a rule here could say -->
              <w-icon
                class="page-blog-post-icon"
                :size="iconSizeFor(index)"
                :name="post.icon || defaultPageIcon" />
            </span>
            <span class="page-blog-post-body">
              <span class="page-blog-post-title">{{ post.title }}</span>
              <span
                class="page-blog-post-desc"
                v-if="settings.show.description && post.description">
                {{ post.description }}
              </span>
              <!--
                Who wrote it and when, on one line under the text: they are the byline, and two lines
                for two short facts is most of a card spent on its footer. Separated only where both
                are on, so a blog showing one of them has no orphan bullet.
              -->
              <span class="page-blog-post-meta" v-if="settings.show.date || settings.show.author">
                <span v-if="settings.show.date">{{ publishedOn(post) }}</span>
                <span class="page-blog-post-sep" v-if="settings.show.date && settings.show.author"
                  >&middot;</span
                >
                <span v-if="settings.show.author && post.authorName">{{ post.authorName }}</span>
              </span>
              <span class="page-blog-post-tags" v-if="settings.show.tags && post.tags.length > 0">
                <!--
                  Plain text, not links: a tag here is inside the link to the post, and an anchor
                  inside an anchor is invalid HTML that browsers unnest -- the filter is picked from
                  the column beside the listing instead, where it can be a control of its own.
                -->
                <span class="page-blog-post-tag" v-for="tag of post.tags" :key="tag">{{
                  tag
                }}</span>
              </span>
            </span>
          </router-link>
        </div>
        <!--
          Only once there is more than one page of the blog. The count above it says what the reader
          is looking at, because a bare row of numbers does not say how many posts they stand for.
        -->
        <div class="page-blog-pager" v-if="blogState.pageCount > 1">
          <w-pagination
            :model-value="blogState.page"
            :max="blogState.pageCount"
            :max-pages="7"
            boundary-numbers
            direction-links
            :aria-label="t(`common.blog.pagination`)"
            @update:model-value="goToPage" />
          <div class="page-blog-count">
            {{ t('common.blog.count', blogState.total, { count: blogState.total }) }}
          </div>
        </div>
        <!--
          The one thing a listing cannot do quietly: a blog past the ceiling is served as a prefix of
          itself, and a reader paging to the end of it would otherwise be told they had reached the
          end of the blog.
        -->
        <div class="page-blog-truncated" v-if="blogState.truncated">
          <w-icon name="la:exclamation-triangle" />
          <div class="pl-3">{{ t('common.blog.truncated') }}</div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { blogState, loadBlog, resetBlog } from '@/composables/blog'

import { parseBlog } from '@/helpers/pageBlog'
import { blogFilterFromQuery } from '@/helpers/blogFilter'

import { DEFAULT_PAGE_ICON, usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import PageNewMenu from '@/components/PageNewMenu.vue'

/**
 * A blog's front page: its posts, rather than an article.
 *
 * Drawn by the page view in place of the content, the way `PageRedirect.vue` is — but inside the
 * scrolling column rather than instead of it, because a blog is a destination: a reader stays on it,
 * scrolls it and reaches the footer at the bottom of it.
 *
 * **Which pages are posts is not decided here and cannot be.** A post is a page under this page's
 * path, and which of those this reader may open is a page rule resolved on the server — so this
 * component draws what `api/blogs.ts` hands it and filters nothing. See `models/blogs.ts`.
 *
 * The reader's selection lives in the query string (`?tag=…&year=…&month=…&p=…`) and not in the path,
 * because the path namespace under a blog belongs to its posts: `/my-blog/2026/03` is a page somebody
 * may well have written. It also makes a filtered blog a link that can be handed to somebody, which
 * is what `/_tags?t=a,b` does for the same reason.
 */

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const route = useRoute()
const router = useRouter()

// I18N

const { t } = useI18n()

const defaultPageIcon = DEFAULT_PAGE_ICON

// COMPUTED

/** How this blog is set up, which is the front page's content. See `helpers/pageBlog.js`. */
const settings = computed(() => parseBlog(pageStore.content))

/**
 * Whether this reader may write a post here.
 *
 * `write:pages` from the PAGE rules and not from the group-wide list, which is the same check the
 * missing-page screen makes and the same one the create endpoint will make — the group-wide list
 * answers "may write pages somewhere", which is how a button ends up leading to a 403.
 *
 * Asked at the blog's own path, since that is where this reader is standing and a post goes directly
 * under it. A rule written deeper could still refuse one particular path, and the editor's own save
 * is what answers that.
 */
const canWriteHere = computed(() => userStore.pagePermissions.includes('write:pages'))

/** The reader's selection, as the URL carries it. */
const filter = computed(() => blogFilterFromQuery(route.query))

/**
 * What the blog is currently narrowed to, in words, or null for a blog showing everything.
 *
 * One line rather than a chip per part, because the parts are not separately removable: a month
 * without its year means nothing, so the way out is out of all of it at once.
 */
const activeFilter = computed(() => {
  const parts = []
  if (filter.value.tag) {
    parts.push(t('common.blog.filterTag', { tag: filter.value.tag }))
  }
  if (filter.value.year) {
    parts.push(
      filter.value.month
        ? monthLabel(filter.value.year, filter.value.month)
        : String(filter.value.year)
    )
  }
  return parts.length > 0 ? parts.join(' · ') : null
})

// METHODS

/**
 * How big a post's icon is drawn.
 *
 * A prop and not a rule, because `WIcon` writes the size as an inline `font-size` — the stylesheet
 * cannot reach it, so this is the only place the featured card's icon can be made bigger. Which
 * card is featured is the same answer the stylesheet gives: the first one of a `cards` listing. A
 * `list` listing has no featured row, and every other card keeps the one size.
 *
 * Note it does not follow the breakpoint the LAYOUT does. Under 600px the featured card puts its
 * panel back across the top, and the big icon goes with it into a taller band — an inline style has
 * no media query, and a band that says "this one is the lead" is the right answer there anyway.
 */
function iconSizeFor(index) {
  return index === 0 && settings.value.layout === 'cards' ? '56px' : '28px'
}

/** Where a post lives, as a route on this site — locale prefix included where the site uses one. */
function postLink(post) {
  return `${siteStore.localeUrlPrefix(pageStore.locale)}/${post.path}`
}

/** A post's publication date, as a reader reads a date rather than as the column stores one. */
function publishedOn(post) {
  return Temporal.Instant.from(post.publishedAt).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

/**
 * A month, named. Built from a date at noon UTC rather than midnight: the archive counts months in
 * UTC (see `facetsFor` on the server), and midnight on the first falls into the previous month for
 * every reader west of Greenwich.
 */
function monthLabel(year, month) {
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  })
}

/** Drop every narrowing, which also takes the reader back to the first page of the blog. */
function clearFilter() {
  router.push({ path: route.path })
}

/** Move within the current filter, so paging never silently widens what is being paged through. */
function goToPage(page) {
  const query = { ...route.query }
  if (page > 1) {
    query.p = String(page)
  } else {
    delete query.p
  }
  router.push({ path: route.path, query })
}

function load() {
  if (!pageStore.path && pageStore.path !== '') {
    return
  }
  loadBlog({
    siteId: siteStore.id,
    path: pageStore.path,
    locale: pageStore.locale,
    filter: filter.value
  })
}

// MOUNTED

onMounted(load)

/*
  Both halves of "which listing is this": the page, because a reader can walk from one blog to another
  without this component being torn down, and the filter, because narrowing a blog is a navigation
  that leaves the component in place.
*/
watch(
  () => [pageStore.id, route.query.tag, route.query.year, route.query.month, route.query.p],
  load
)

/*
  Emptied on the way out rather than left standing. The listing is a module singleton shared with the
  sidebar, so a stale one would be a tag cloud drawn beside the next page the reader opens.
*/
onBeforeUnmount(resetBlog)
</script>

<style lang="scss">
.page-blog {
  /*
    Centred in the column rather than filling it. This is a listing and not prose: stretched across a
    full-width window `is-cards` reaches four columns and `is-list` draws a one-line title on a band
    the width of the screen. The cap is set so that a wide screen still gets the three columns the
    360px floor was chosen for, and no more.

    On the block rather than on the listing, so the intro above it and the pager below sit over the
    same measure -- a paragraph starting at the column's edge over a centred grid is the half-centred
    layout this is avoiding. The sidebar, where a blog asks for one, is outside this element and is
    unaffected.
  */
  max-width: 1200px;
  margin: 0 auto;

  /*
    Stated per theme, for the same reason `.page-placeholder` states it: this block sits BESIDE
    `.page-contents` rather than inside it, so none of the ink `_page-contents.scss` declares reaches
    it and it would inherit the document's black and go invisible on the dark surface. Everything
    below that carries no colour of its own -- the empty state and its icon, the filter bar, the
    status line, the count under the pager -- reads off this one.
  */
  @at-root .body--light & {
    color: $grey-9;

    /*
      The hairline closing a card's gradient panel, which an ordinary card draws along its bottom and
      the featured card down its right. One property rather than the pair written twice per edge: the
      two edges are one line, and a value that has to agree in four places is a value that eventually
      will not.

      Light: white, a highlight along the edge of the gradient.
    */
    --blog-lid-seam: #{'#fff'};
  }
  @at-root .body--dark & {
    color: #fff;

    /*
      Dark: the page's own background behind the card -- `$dark-6`, set on `body.body--dark` in
      `MainLayout.vue`, since nothing between the body and the article column paints over it. So the
      line reads as a sliver of the page showing through rather than as a border drawn on the card,
      which is what white was doing there: a bright rule across a dark card, and the first thing the
      eye landed on in the whole listing.
    */
    --blog-lid-seam: #{$dark-6};
  }

  /* -> The author's own words, in the article's voice rather than in the listing's */
  &-intro {
    margin: 0 0 24px;
    white-space: pre-line;
    font-size: 1rem;
    line-height: 1.6;

    @at-root .body--light & {
      color: rgba(0, 0, 0, 0.75);
    }
    @at-root .body--dark & {
      color: rgba(255, 255, 255, 0.75);
    }
  }

  &-filters {
    display: flex;
    align-items: center;
    margin-bottom: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 0.85rem;

    @at-root .body--light & {
      background-color: $grey-2;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  &-status {
    padding: 48px 0;
    text-align: center;
    font-size: 0.875rem;
    opacity: 0.6;
  }

  &-empty {
    padding: 56px 16px;
    text-align: center;

    &-icon {
      font-size: 64px;
      opacity: 0.2;
    }
  }

  /* ---------------------------------------------------------------- */
  /* The three layouts. Same markup, three ways of arranging it -- the */
  /* post is a link with an icon and a stack of text in every one.     */
  /* ---------------------------------------------------------------- */
  &-list {
    display: grid;
    gap: 12px;

    /*
      One column per row otherwise, which is `list` and needs no rule of its own.

      The floor is what decides how many columns fit, and it is deliberately high: a post entry is a
      title, a blurb and a byline, all of which read badly in a narrow column, and `auto-fill` will
      otherwise put four of them across a wide screen. At this width a normal window gets two and a
      very wide one three, and the cards stay wide enough for a description to be worth showing.
    */
    &.is-cards {
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    }
  }

  &-post {
    display: flex;
    align-items: flex-start;
    padding: 14px 16px;
    border-radius: 5px;
    text-decoration: none;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;

    @at-root .body--light & {
      background-color: $grey-1;
      border: 1px solid rgba(0, 0, 0, 0.07);
      color: rgba(0, 0, 0, 0.87);
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border: 1px solid rgba(255, 255, 255, 0.07);
      color: rgba(255, 255, 255, 0.85);
    }
    &:hover {
      @at-root .body--light & {
        background-color: $grey-2;
      }
      @at-root .body--dark & {
        background-color: $dark-3;
      }
    }

    /*
      A card stacks its lid over its text; a row puts icon and text side by side.

      The padding moves off the card and onto the body, because the lid is drawn to the card's four
      edges and cannot be inset by it -- cancelling it with a negative margin instead would be the
      same figure written twice, in two places that have to agree. `overflow` is what then hands the
      lid the rounded corners it is sitting in.

      `align-items` has to be restated: the base rule starts the icon at the TOP of a row, and the
      same property means the LEFT of a column -- so left alone it sizes the lid to the icon in it
      rather than to the card. Stretch is what a stacked card wants throughout: the lid spans it, and
      the text below fills it instead of being as wide as its longest line.
    */
    @at-root .page-blog-list.is-cards & {
      flex-direction: column;
      align-items: stretch;
      overflow: hidden;
      padding: 0;

      /*
        A card is lifted off the page; a list row is not. Two layers rather than one -- a tight
        near-black edge that reads as the card's own weight, and a wider soft one that is the light
        falling past it -- because a single blurred shadow at this opacity reads as a grey smudge
        under the card rather than as depth.

        Deeper in the dark theme for the same apparent subtlety: shadow is black on both, and against
        `dark-4` the light theme's opacities are not a faint shadow but no shadow at all.
      */
      @at-root .body--light & {
        box-shadow:
          0 1px 2px rgb(0 0 0 / 0.06),
          0 2px 6px rgb(0 0 0 / 0.05);
      }
      @at-root .body--dark & {
        box-shadow:
          0 1px 2px rgb(0 0 0 / 0.3),
          0 2px 6px rgb(0 0 0 / 0.25);
      }

      /*
        The first post, across every column: the featured card.

        `1 / -1` counts to the last line of the EXPLICIT grid, which `auto-fill` still defines -- the
        track count comes from the template, so this is the whole row however many columns the window
        got. Narrow enough for one column it is already the full width and the rule changes nothing.

        It is the first card of whatever is on screen rather than the first post of the blog, so page
        two of the listing leads with one too. That is the layout staying put as a reader pages
        through it: a grid whose top row is wide on one page and not on the next reads as something
        having gone wrong, and the card is a shape here rather than a claim about the post in it.
      */
      &:first-child {
        grid-column: 1 / -1;

        /*
          And it lays its panel down the LEFT rather than across the top. A full-width card is wide
          enough that a band over it is a stripe with a lot of nothing under it; beside the text it
          is a panel, which is what the extra width bought.

          Back to a band below `xs`, where a third of a phone-width card is about 110px of gradient
          and the text is left with 220px to hold a title, a blurb, a byline and its tags. The
          featured card keeps its full width there -- the grid is one column anyway -- and only the
          arrangement inside it goes back to the stacked one.
        */
        @media (min-width: #{$breakpoint-xs-max + 0.02px}) {
          flex-direction: row;
        }
      }

      /*
        Further off the page under the pointer: the soft layer alone, pushed down and spread wide,
        which is what a shadow does as its caster rises.

        The tight layer goes rather than growing with it. It is a contact shadow -- the dark seam
        where an object meets the surface it is resting on -- and a card that has lifted is no longer
        resting on anything, so kept underneath it reads as a hard line drawn under the card rather
        than as height.

        White with it, up from `grey-1`: a card that has risen off the page catches more light, so it
        brightens as it lifts. That is the light theme's answer and not the dark theme's -- white on
        `dark-4` is not a lift but an inversion, and the card's own ink is white. The dark theme keeps
        its step towards the lighter surface, which is the same move in its own register.
      */
      @at-root .body--light &:hover {
        background-color: #fff;
        box-shadow: 0 6px 16px rgb(0 0 0 / 0.08);
      }
      @at-root .body--dark &:hover {
        box-shadow: 0 6px 16px rgb(0 0 0 / 0.32);
      }
    }

    /*
      The lid. Out of the way in the list layout: `display: contents` draws the children and no box,
      so the icon below is a flex item of the card itself and every rule in this block is inert.
    */
    &-media {
      display: contents;

      @at-root .page-blog-list.is-cards & {
        display: flex;
        align-items: center;
        justify-content: flex-start;

        /* -> 16px at the left, which is the body's own inset below: the icon sits over the title
              rather than a few pixels off it */
        padding: 18px 16px;

        /*
          Lit from the bottom-right corner: an ellipse centred there, the lighter brand shade at the
          corner falling to the brand colour as it spreads back across the card.

          The custom properties rather than the SCSS `$primary` beside them -- a site themes itself by
          rewriting `--q-primary` at runtime (see `css/tailwind.css`), which a value compiled into the
          stylesheet cannot follow. `primary-lighter` is itself a `color-mix` off the same property,
          so both ends of the gradient re-theme together.
        */
        background: radial-gradient(
          ellipse at bottom right,
          var(--color-primary-lighter),
          var(--color-primary)
        );

        /* -> The hairline closing the lid; the colour is per theme, see `--blog-lid-seam` above */
        border-bottom: 1px solid var(--blog-lid-seam);
      }

      /*
        The featured card's panel: a third of the card, down its left, full height.

        `0 0 33.333%` rather than `1 1` -- a third is the figure, not a starting point, so the panel
        does not grow into the space a short title leaves. The seam turns the corner with it: the
        same line, drawn on the edge that now divides the two halves.
      */
      @at-root .page-blog-list.is-cards .page-blog-post:first-child & {
        @media (min-width: #{$breakpoint-xs-max + 0.02px}) {
          flex: 0 0 33.333%;
          border-right: 1px solid var(--blog-lid-seam);
          border-bottom: 0;
        }

        /*
          And it is the SECONDARY colour, which is what separates the lead card from the listing
          under it at a glance -- the width says it is different, the hue says which one it is.

          Outside the media query, unlike the arrangement above: below `xs` the panel goes back to a
          band across the top, and it is still the featured card while it does.
        */
        background: radial-gradient(
          ellipse at bottom right,
          var(--color-secondary-lighter),
          var(--color-secondary)
        );
      }
    }

    &-icon {
      flex: 0 0 auto;
      margin-right: 14px;
      color: $primary;

      /* -> On the gradient rather than on the card, so it is drawn in the surface's own ink */
      @at-root .page-blog-list.is-cards & {
        margin: 0;
        color: #fff;
      }
    }

    &-body {
      display: flex;
      min-width: 0;
      flex: 1 1 auto;
      flex-direction: column;

      /* -> The padding the card gave up, so the text keeps the inset the lid may not have */
      @at-root .page-blog-list.is-cards & {
        padding: 14px 16px;
      }
    }

    &-title {
      font-weight: 500;
      line-height: 1.35;

      /*
        A step up on a card, where the title is the thing being scanned and the rest of the card is
        support: it inherits the app's 14px otherwise, which is the same size as the body text a row
        in the `list` layout sits in a line of. 1rem is 16px against that 14 -- stated in `rem` like
        the description and byline below it, which are 0.8 and 0.75 of the same unit.

        A list row keeps the inherited size. There the title IS the row, with nothing above it to be
        distinguished from.
      */
      @at-root .page-blog-list.is-cards & {
        font-size: 1rem;
      }

      /*
        One step further on the featured card, which is the only entry in the listing whose title is
        competing with anything: it sits beside a third of a card of colour and an icon at twice the
        size, and at the same 16px as the grid below it read as a caption to the panel rather than as
        the lead.

        A step and not a headline -- these are all one listing, and a title that jumps to a heading
        size stops reading as the first of twenty-five posts and starts reading as a section above
        them.
      */
      @at-root .page-blog-list.is-cards .page-blog-post:first-child & {
        font-size: 1.25rem;
      }
    }

    &-desc {
      margin-top: 2px;
      font-size: 0.8rem;
      line-height: 1.4;
      opacity: 0.7;
    }

    &-meta {
      margin-top: 6px;
      font-size: 0.75rem;
      opacity: 0.55;
    }

    &-sep {
      padding: 0 6px;
    }

    &-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }

    &-tag {
      padding: 1px 7px;
      border-radius: 3px;
      font-size: 0.7rem;

      @at-root .body--light & {
        background-color: $grey-3;
      }
      @at-root .body--dark & {
        background-color: $dark-2;
      }
    }
  }

  &-pager {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 28px;
  }

  &-count {
    font-size: 0.75rem;
    opacity: 0.55;
  }

  &-truncated {
    display: flex;
    align-items: flex-start;
    margin-top: 20px;
    padding: 12px 16px;
    border-radius: 4px;
    background-color: rgba(255, 152, 0, 0.12);
    font-size: 0.8rem;
    line-height: 1.4;
    color: $orange-9;

    @at-root .body--dark & {
      color: $orange-3;
    }
  }
}
</style>
