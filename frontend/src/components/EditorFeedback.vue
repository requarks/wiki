<template>
  <div class="editor-feedback">
    <w-scroll-area style="height: 100%">
      <div class="editor-feedback-form">
        <!-- ----------------------- -->
        <!-- The board itself -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('editor.feedback.title') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="new-document" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.pageTitle') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.pageTitleHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <!-- -> The same title the header edits in place, as on a blog -->
              <w-input
                outlined
                dense
                hide-bottom-space
                :model-value="pageStore.title"
                :aria-label="t(`editor.feedback.pageTitle`)"
                @update:model-value="setTitle" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="subtitles" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.pageDescription') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.pageDescriptionHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                dense
                hide-bottom-space
                :model-value="pageStore.description"
                :aria-label="t(`editor.feedback.pageDescription`)"
                @update:model-value="setDescription" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="quote-left" top />
            <w-item-section top>
              <w-item-label>{{ t('editor.feedback.intro') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.introHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <!-- -> Previewed in the typography the board draws it in (`.feedback-prose`) -->
              <feedback-markdown-field
                preview-class="feedback-prose"
                :rows="4"
                :max-length="FEEDBACK_MAX_INTRO"
                :model-value="state.intro"
                :placeholder="t(`editor.feedback.intro`)"
                @update:model-value="setIntro" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Ideas -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('editor.feedback.ideasTitle') }}</w-card-header>
          <!--
            The two rules of the feature, said where the author is deciding where to save the board:
            what is in this folder is an idea, and whoever may read the board may read all of them.
          -->
          <div class="editor-feedback-note">
            <w-icon class="shrink-0" name="la:info-circle" size="sm" />
            <div class="pl-3">{{ t('editor.feedback.ideasHint', { path: ideasPath }) }}</div>
          </div>
          <w-item>
            <blueprint-icon icon="inbox" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.acceptsIdeas') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.acceptsIdeasHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="state.acceptsIdeas"
                :aria-label="t(`editor.feedback.acceptsIdeas`)"
                @update:model-value="setField('acceptsIdeas', $event)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <!--
            What a submitter reads before they type anything (`FeedbackSubmitDialog.vue`): the intro's
            markdown and its preview, since both are drawn in the same typography.
          -->
          <w-item>
            <blueprint-icon icon="info-popup" top />
            <w-item-section top>
              <w-item-label>{{ t('editor.feedback.submitNotice') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.submitNoticeHint') }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <feedback-markdown-field
                preview-class="feedback-prose"
                :rows="3"
                :max-length="FEEDBACK_MAX_SUBMIT_NOTICE"
                :model-value="state.submitNotice"
                :placeholder="t(`editor.feedback.submitNotice`)"
                @update:model-value="setSubmitNotice" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="star-half-empty" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.voting') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.votingHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="state.voting"
                :aria-label="t(`editor.feedback.voting`)"
                @update:model-value="setField('voting', $event)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="sort-by-follow-up-date" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.sort') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.sortHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-select
                class="editor-feedback-select"
                outlined
                dense
                emit-value
                map-options
                :options="sortOptions"
                :model-value="state.sort"
                :aria-label="t(`editor.feedback.sort`)"
                @update:model-value="setField('sort', $event)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="list" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.perPage') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.perPageHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-input
                class="editor-feedback-number"
                outlined
                dense
                hide-bottom-space
                type="number"
                :min="1"
                :max="FEEDBACK_MAX_PER_PAGE"
                :model-value="state.perPage"
                :aria-label="t(`editor.feedback.perPage`)"
                @update:model-value="setPerPage"
                @blur="settlePerPage" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- Categories -->
        <!-- ----------------------- -->
        <w-card class="mt-4 pb-2">
          <w-card-header>{{ t('editor.feedback.categoriesTitle') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="tags" top />
            <w-item-section top>
              <w-item-label>{{ t('editor.feedback.categories') }}</w-item-label>
              <w-item-label caption>{{ t('editor.feedback.categoriesHint') }}</w-item-label>
            </w-item-section>
          </w-item>
          <!--
            One row per category: the name readers see, and the tag it is stored as. Two fields
            rather than one, because the tag is what an idea carries and what a page rule or a tag
            search finds, and renaming what a category is CALLED must not untag every idea in it.
          -->
          <div class="editor-feedback-categories">
            <div
              class="editor-feedback-category"
              v-for="(category, index) of state.categories"
              :key="index">
              <w-input
                outlined
                dense
                hide-bottom-space
                :model-value="category.label"
                :label="t('editor.feedback.categoryLabel')"
                @update:model-value="setCategory(index, 'label', $event)" />
              <w-input
                outlined
                dense
                hide-bottom-space
                monospaced
                :model-value="category.tag"
                :label="t('editor.feedback.categoryTag')"
                @update:model-value="setCategory(index, 'tag', $event)" />
              <w-btn
                flat
                dense
                round
                size="sm"
                color="grey"
                icon="la:arrow-up"
                :disable="index === 0"
                :aria-label="t('editor.feedback.categoryUp')"
                @click="moveCategory(index, -1)" />
              <w-btn
                flat
                dense
                round
                size="sm"
                color="grey"
                icon="la:arrow-down"
                :disable="index === state.categories.length - 1"
                :aria-label="t('editor.feedback.categoryDown')"
                @click="moveCategory(index, 1)" />
              <w-btn
                flat
                dense
                round
                size="sm"
                color="negative"
                icon="la:trash-alt"
                :aria-label="t('editor.feedback.categoryRemove')"
                @click="removeCategory(index)" />
            </div>
            <w-btn
              class="acrylic-btn mt-2"
              flat
              no-caps
              size="sm"
              color="primary"
              icon="la:plus"
              :label="t('editor.feedback.categoryAdd')"
              :disable="state.categories.length >= FEEDBACK_MAX_CATEGORIES"
              @click="addCategory" />
          </div>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="user-typing-using-typewriter" />
            <w-item-section>
              <w-item-label>{{ t('editor.feedback.submitterCategories') }}</w-item-label>
              <w-item-label caption>{{
                t('editor.feedback.submitterCategoriesHint')
              }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="state.submitterCategories"
                :aria-label="t(`editor.feedback.submitterCategories`)"
                @update:model-value="setField('submitterCategories', $event)" />
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
  FEEDBACK_MAX_CATEGORIES,
  FEEDBACK_MAX_CATEGORY_LENGTH,
  FEEDBACK_MAX_INTRO,
  FEEDBACK_MAX_SUBMIT_NOTICE,
  FEEDBACK_MAX_PER_PAGE,
  FEEDBACK_SORTS,
  normalizeCategories,
  parseBoard
} from '@/helpers/pageFeedback'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'

import FeedbackMarkdownField from '@/components/FeedbackMarkdownField.vue'

/** As long a description as the page's column will take, as on a blog (`EditorBlog.vue`). */
const PAGE_DESCRIPTION_MAX = 255

/**
 * The `feedback` editor: the front page of a feedback board.
 *
 * The blog's editor (`EditorBlog.vue`) for a board: a form rather than an editor, whose fields are the
 * page's content as JSON — see `helpers/pageFeedback.js` — apart from the title and the description,
 * which are columns on the page and written straight to the store. Nothing here names an idea: an idea
 * is an idea by sitting in this page's folder (`models/feedback.ts`).
 *
 * What the page then DOES with it is `PageFeedback.vue`, which the page view draws in place of an
 * article.
 */

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

/**
 * The board being edited, which is also exactly what gets saved. Seeded from the stored content and
 * written back by the watcher below.
 */
const state = reactive(parseBoard(pageStore.content))

// COMPUTED

const sortOptions = computed(() =>
  FEEDBACK_SORTS.map((value) => ({ value, label: t(`common.feedback.sorts.${value}`) }))
)

/** The folder ideas go in, read off the page being written so that moving the page moves it too. */
const ideasPath = computed(() => `/${pageStore.path}/`)

// WATCHERS

/*
  The form IS the content, so the store follows it on every keystroke -- immediately, and not as a
  change, for the reason the blog editor gives: this also writes the canonical spelling of what was
  stored, which is not an edit. `touch` is what the handlers call where a person did something.

  Serialized from the form directly rather than through `parseBoard`, which would drop a category row
  somebody has added and not yet typed into -- the server drops empty ones on save, as `parseBoard`
  does on the next read.
*/
watch(
  state,
  (value) => {
    pageStore.content = JSON.stringify({
      ...value,
      categories: normalizeCategories(value.categories)
    })
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

function setDescription(description) {
  pageStore.description = (description ?? '').slice(0, PAGE_DESCRIPTION_MAX)
  touch()
}

function setIntro(intro) {
  state.intro = (intro ?? '').slice(0, FEEDBACK_MAX_INTRO)
  touch()
}

function setSubmitNotice(notice) {
  state.submitNotice = (notice ?? '').slice(0, FEEDBACK_MAX_SUBMIT_NOTICE)
  touch()
}

function setField(key, value) {
  state[key] = value
  touch()
}

/** As the blog's `setNumber`: the floor while typing, the ceiling once the field is left. */
function setPerPage(value) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return
  }
  state.perPage = Math.max(parsed, 1)
  touch()
}

function settlePerPage() {
  if (state.perPage > FEEDBACK_MAX_PER_PAGE) {
    state.perPage = FEEDBACK_MAX_PER_PAGE
  }
}

function addCategory() {
  state.categories.push({ tag: '', label: '' })
  touch()
}

/**
 * Typing a label writes the tag with it while the tag still follows the label — a new row, or one
 * whose tag is still the label's own spelling — so that the common case is one field to fill in.
 * Once the tag has been typed by hand it is left alone.
 */
function setCategory(index, key, value) {
  const category = state.categories[index]
  const text = (value ?? '').slice(0, FEEDBACK_MAX_CATEGORY_LENGTH)
  if (key === 'label' && (!category.tag || category.tag === tagFor(category.label))) {
    category.tag = tagFor(text)
  }
  category[key] = key === 'tag' ? text.toLowerCase() : text
  touch()
}

/** A tag as a label would be written as one: lowercased, spaces joined with hyphens. */
function tagFor(label) {
  return (label ?? '').trim().toLowerCase().replace(/\s+/g, '-')
}

function moveCategory(index, step) {
  const [category] = state.categories.splice(index, 1)
  state.categories.splice(index + step, 0, category)
  touch()
}

function removeCategory(index) {
  state.categories.splice(index, 1)
  touch()
}
</script>

<style lang="scss">
.editor-feedback {
  height: 100%;

  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  /*
    A form, not a document, but held to the measure of the page it becomes (`$content-centered-max-width`)
    rather than to a narrower one of its own: what is laid out here is drawn at that width once saved.
    The side padding is added to it so that the fields themselves get the full measure, as the page's
    body does inside its own padding.
  */
  &-form {
    max-width: calc(#{$content-centered-max-width} + 32px);
    margin: 0 auto;
    padding: 24px 16px 48px;
  }

  &-select {
    min-width: 170px;
  }

  &-number {
    width: 96px;
  }

  /* -> Under the row that introduces them, lined up with its label as the blog's switches are */
  &-categories {
    padding: 0 16px 8px 72px;
  }

  &-category {
    display: grid;
    grid-template-columns: 1fr 1fr auto auto auto;
    align-items: center;
    gap: 8px;

    & + & {
      margin-top: 8px;
    }
  }

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
