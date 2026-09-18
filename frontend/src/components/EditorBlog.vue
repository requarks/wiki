<template>
  <div class="editor-blog">
    <w-scroll-area style="height: 100%">
      <div class="editor-blog-form">
        <!-- ----------------------- -->
        <!-- The blog itself -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('editor.blog.title') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="new-document" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.pageTitle') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.pageTitleHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <!--
                The same title the header edits in place, so the two are one field with two places to
                type it: both write to the store, and the header's watcher follows what is typed here.
              -->
              <w-input
                outlined
                dense
                hide-bottom-space
                :model-value="pageStore.title"
                :aria-label="t(`editor.blog.pageTitle`)"
                @update:model-value="setTitle" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="subtitles" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.pageDescription') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.pageDescriptionHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <!--
                The page's own description, not a blog setting -- the same field the properties panel
                calls Short Description, offered here because it is what a reader sees under the
                blog's name and an author on this screen should not have to go looking for it.
              -->
              <w-input
                outlined
                dense
                hide-bottom-space
                :model-value="pageStore.description"
                :aria-label="t(`editor.blog.pageDescription`)"
                @update:model-value="setDescription" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="quote-left" top />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.intro') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.introHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                dense
                hide-bottom-space
                type="textarea"
                :rows="3"
                :model-value="state.intro"
                :aria-label="t(`editor.blog.intro`)"
                @update:model-value="setIntro" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Which pages are posts -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('editor.blog.postsTitle') }}</w-card-header>
          <!--
            The one rule of the whole feature, said out loud where the author is deciding where to
            save the page: what is under this path is a post. Nothing is written on a post to mark it
            as one, so this sentence is the entire contract.
          -->
          <div class="editor-blog-note">
            <w-icon name="la:info-circle" />
            <div class="pl-3">{{ t('editor.blog.postsHint', { path: postsPath }) }}</div>
          </div>
          <w-item>
            <blueprint-icon icon="depth" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.depth') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.depthHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-input
                class="editor-blog-number"
                outlined
                dense
                hide-bottom-space
                type="number"
                :min="0"
                :max="BLOG_MAX_DEPTH"
                :model-value="state.depth"
                :aria-label="t(`editor.blog.depth`)"
                @update:model-value="setDepth"
                @blur="settleDepth" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="sort-by-follow-up-date" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.sort') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.sortHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-select
                class="editor-blog-select"
                outlined
                dense
                emit-value
                map-options
                :options="sortOptions"
                :model-value="state.sort"
                :aria-label="t(`editor.blog.sort`)"
                @update:model-value="setSort" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- How the listing looks -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('editor.blog.listingTitle') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="index" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.layout') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.layoutHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-select
                class="editor-blog-select"
                outlined
                dense
                emit-value
                map-options
                :options="layoutOptions"
                :model-value="state.layout"
                :aria-label="t(`editor.blog.layout`)"
                @update:model-value="setLayout" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="list" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.perPage') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.perPageHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-input
                class="editor-blog-number"
                outlined
                dense
                hide-bottom-space
                type="number"
                :min="1"
                :max="BLOG_MAX_PER_PAGE"
                :model-value="state.perPage"
                :aria-label="t(`editor.blog.perPage`)"
                @update:model-value="setPerPage"
                @blur="settlePerPage" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <!--
            What a post entry carries, as one row of switches rather than five rows of their own: they
            are one decision made five times, and a row apiece would be most of this screen.
          -->
          <w-item>
            <blueprint-icon icon="tune" top />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.showFields') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.showFieldsHint') }}</w-item-label>
            </w-item-section>
          </w-item>
          <div class="editor-blog-checks">
            <w-checkbox
              v-for="field of SHOW_FIELDS"
              :key="field"
              :label="t(`editor.blog.show.${field}`)"
              :model-value="state.show[field]"
              @update:model-value="setShow(field, $event)" />
          </div>
        </w-card>
        <!-- ----------------------- -->
        <!-- What the sidebar offers -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('editor.blog.sidebarTitle') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="filtration" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.sidebarTags') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.sidebarTagsHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="state.sidebar.tags"
                :aria-label="t(`editor.blog.sidebarTags`)"
                @update:model-value="setSidebar('tags', $event)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="calendar" />
            <w-item-section>
              <w-item-label>{{ t('editor.blog.sidebarArchive') }}</w-item-label>
              <w-item-label caption>{{ t('editor.blog.sidebarArchiveHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="state.sidebar.archive"
                :aria-label="t(`editor.blog.sidebarArchive`)"
                @update:model-value="setSidebar('archive', $event)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </w-scroll-area>
  </div>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  BLOG_LAYOUTS,
  BLOG_MAX_DEPTH,
  BLOG_MAX_INTRO,
  BLOG_MAX_PER_PAGE,
  BLOG_SORTS,
  parseBlog,
  serializeBlog
} from '@/helpers/pageBlog'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'

/**
 * As long a description as the page's column will take. Mirrors the `maxLength` the API schema puts
 * on it (`api/schemas/page.ts`), which is what makes it a ceiling rather than a preference.
 */
const PAGE_DESCRIPTION_MAX = 255

/**
 * The `blog` editor: the front page of a blog.
 *
 * There is no content to write, so this is a form rather than an editor — a title, a description, an
 * introduction, and how the listing beneath it should behave. All of it except the title and the
 * description is the page's content, as JSON; those two are columns on the page itself and are
 * written straight to the store, the same ones the properties panel edits. See `helpers/pageBlog.js`,
 * and `models/blogs.ts` on the server for what a POST is: nothing here names one, because a post is a
 * post by sitting under this page's path.
 *
 * What the page then DOES with that is `PageBlog.vue`, which the page view draws in place of an
 * article.
 */

/** The fields of a post whose display is a switch, in the order they are offered. */
const SHOW_FIELDS = ['icon', 'description', 'author', 'date', 'tags']

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

/**
 * The blog being edited, which is also exactly what gets saved — every field of the form is one of
 * these. Seeded from the stored content and written back by the watcher below.
 */
const state = reactive(parseBlog(pageStore.content))

// COMPUTED

const layoutOptions = computed(() =>
  BLOG_LAYOUTS.map((value) => ({ value, label: t(`editor.blog.layouts.${value}`) }))
)

const sortOptions = computed(() =>
  BLOG_SORTS.map((value) => ({ value, label: t(`editor.blog.sorts.${value}`) }))
)

/**
 * The path posts go under, as the sentence above the settings names it.
 *
 * Read off the page being written rather than off a saved blog, so that moving the page in the path
 * field moves the sentence with it — this is the one rule of the feature and it has to describe where
 * the author is actually about to save.
 */
const postsPath = computed(() => `/${pageStore.path}/`)

// WATCHERS

/*
  The form IS the content, so the store follows it on every keystroke — there is nothing here that a
  save would collect afterwards.

  Immediate, and deliberately not a change: this also writes the canonical spelling of what was
  already stored, and seeds a page being created with an empty blog. Neither is an edit, so neither
  may set the unsaved-changes flag — `touch` is called by the handlers instead, where a person
  actually did something.
*/
watch(
  state,
  (value) => {
    pageStore.content = serializeBlog(value)
  },
  { immediate: true, deep: true }
)

// METHODS

/** Say that the page has unsaved changes, which is what turns the header's Save button on. */
function touch() {
  editorStore.lastChangeTimestamp = Temporal.Now.instant()
}

function setTitle(title) {
  pageStore.title = title
  touch()
}

/**
 * Held to the column's own 255 characters, in the form rather than at the save — the same reason
 * {@link setIntro} holds the introduction to its ceiling: a limit the field does not enforce is a
 * save refused after the typing instead of during it.
 */
function setDescription(description) {
  pageStore.description = (description ?? '').slice(0, PAGE_DESCRIPTION_MAX)
  touch()
}

/**
 * Held to the same ceiling the server holds it to, here rather than with a `maxlength` attribute: the
 * field is a `w-input`, which passes on the props it declares and nothing else, and a limit the form
 * does not enforce would be a save refused after the typing rather than during it.
 */
function setIntro(intro) {
  state.intro = (intro ?? '').slice(0, BLOG_MAX_INTRO)
  touch()
}

/**
 * A number field, as it is being typed.
 *
 * Two things a field like this gets wrong if it is written naively, and both of them here:
 *
 * - **An emptied field hands back an empty string**, which `Number.parseInt` reads as `NaN`. Left
 *   alone until it parses again, so that clearing the field in order to type a new number does not
 *   reset it to the default under the typist.
 * - **The CEILING is not enforced while typing.** Editing `10` into `500` passes through `50` and
 *   then `500`, and a handler that clamped each keystroke would write `100` the moment the third
 *   digit landed — after which every further keystroke appends to `100` and clamps back to it, so
 *   the field can never be typed down again without being cleared first. The floor has no such
 *   problem (nothing types its way up through a number that is too small), so it is applied here and
 *   the ceiling waits for `settleNumber`.
 */
function setNumber(key, value, min) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return
  }
  state[key] = Math.max(parsed, min)
  touch()
}

/**
 * The same field, once the typist has left it.
 *
 * Where the ceiling is applied, so that what is on screen at rest is what will be saved — the server
 * clamps to the same figure (`normalizeBlogContent`), and a field that showed 500 while the page
 * stored 100 would be the form disagreeing with itself.
 */
function settleNumber(key, max) {
  if (state[key] > max) {
    state[key] = max
  }
}

function setDepth(value) {
  setNumber('depth', value, 0)
}

function settleDepth() {
  settleNumber('depth', BLOG_MAX_DEPTH)
}

function setPerPage(value) {
  setNumber('perPage', value, 1)
}

function settlePerPage() {
  settleNumber('perPage', BLOG_MAX_PER_PAGE)
}

function setLayout(layout) {
  state.layout = layout
  touch()
}

function setSort(sort) {
  state.sort = sort
  touch()
}

function setShow(field, value) {
  state.show[field] = value
  touch()
}

function setSidebar(field, value) {
  state.sidebar[field] = value
  touch()
}
</script>

<style lang="scss">
.editor-blog {
  height: 100%;

  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  /* -> A form, not a document: it stops widening well before the column does */
  &-form {
    max-width: 780px;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }

  /* -> Wide enough for the longest option and no wider; these sit in a `side` section */
  &-select {
    min-width: 160px;
  }

  &-number {
    width: 96px;
  }

  /*
    Lined up with the main section of the row above it: `w-item` pads 16px and its avatar section is
    56px wide, so the switches start where that row's label does.
  */
  &-checks {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 20px;
    padding: 0 16px 8px 72px;
  }

  /* -> The one rule of the feature, stated where the author is deciding where to save the page */
  &-note {
    display: flex;
    align-items: flex-start;
    margin: 0 16px 8px;
    padding: 12px 16px;
    border-radius: 4px;
    background-color: rgba(25, 118, 210, 0.1);
    color: $blue-9;
    font-size: 0.8rem;
    line-height: 1.4;

    @at-root .body--dark & {
      color: $blue-3;
    }
  }
}
</style>
