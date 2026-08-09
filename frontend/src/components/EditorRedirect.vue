<template>
  <div class="editor-redirect">
    <w-scroll-area style="height: 100%">
      <div class="editor-redirect-form">
        <w-card class="pb-2">
          <w-card-header>{{ t('editor.redirect.title') }}</w-card-header>
          <!-- ----------------------- -->
          <!-- Title -->
          <!-- ----------------------- -->
          <w-item>
            <blueprint-icon icon="new-document" />
            <w-item-section>
              <w-item-label>{{ t('editor.redirect.pageTitle') }}</w-item-label>
              <w-item-label caption>{{ t('editor.redirect.pageTitleHint') }}</w-item-label>
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
                :aria-label="t(`editor.redirect.pageTitle`)"
                @update:model-value="setTitle" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <!-- ----------------------- -->
          <!-- Target -->
          <!-- ----------------------- -->
          <w-item>
            <blueprint-icon icon="advance" />
            <w-item-section>
              <w-item-label>{{ t('editor.redirect.target') }}</w-item-label>
              <w-item-label caption>{{ t('editor.redirect.targetHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:folder-open"
                color="primary"
                padding="xs md"
                no-caps
                :label="t(`editor.redirect.choose`)"
                @click="chooseTarget" />
            </w-item-section>
          </w-item>
          <!--
            What was chosen, indented to the row above rather than made a row of its own: it is that
            row's answer, and a `w-item` of its own would need an empty avatar section to line up
            with. The icon says which kind it is, which is the only place that distinction shows now
            that one dialog answers both halves of it.
          -->
          <div class="editor-redirect-field">
            <div class="text-body2 font-robotomono editor-redirect-target" v-if="state.target">
              <w-icon
                class="mr-2"
                :name="state.kind === `url` ? `la:globe` : `la:file-alt`"
                size="sm" />
              {{ state.target }}
            </div>
            <div class="text-caption opacity-60" v-else>
              {{ t('editor.redirect.noTargetSelected') }}
            </div>
          </div>
          <w-separator class="my-2" inset />
          <!-- ----------------------- -->
          <!-- Interstitial -->
          <!-- ----------------------- -->
          <w-item>
            <blueprint-icon icon="timer" />
            <w-item-section>
              <w-item-label>{{ t('editor.redirect.showInterstitial') }}</w-item-label>
              <w-item-label caption>{{ t('editor.redirect.showInterstitialHint') }}</w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="state.showInterstitial"
                :aria-label="t(`editor.redirect.showInterstitial`)"
                @update:model-value="setShowInterstitial" />
            </w-item-section>
          </w-item>
        </w-card>
        <!--
          What the page will do, spelled out, because everything above is settings and none of it says
          what a reader arriving here actually gets. Also where a half-filled form is reported: the
          save is refused by the server either way, and this says so before it is attempted.
        -->
        <div
          class="editor-redirect-summary"
          :class="isFollowable(state) ? `is-ready` : `is-incomplete`">
          <w-icon :name="isFollowable(state) ? `la:info-circle` : `la:exclamation-triangle`" />
          <div class="pl-3">
            <template v-if="!isFollowable(state)">
              {{ t('editor.redirect.summaryIncomplete') }}
            </template>
            <template v-else-if="state.showInterstitial">
              {{ t('editor.redirect.summaryInterstitial', { target: state.target }) }}
            </template>
            <template v-else>
              {{ t('editor.redirect.summaryDirect', { target: state.target }) }}
            </template>
          </div>
        </div>
      </div>
    </w-scroll-area>
  </div>
</template>

<script setup>
import { defineAsyncComponent, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialog } from '@/composables/dialog'

import { isFollowable, parseRedirect, serializeRedirect } from '@/helpers/pageRedirect'

import { useEditorStore } from '@/stores/editor'
import { usePageStore } from '@/stores/page'

/**
 * The `redirect` editor: a page that sends its reader somewhere else.
 *
 * There is no content to write, so this is a form rather than an editor — a title, where the page
 * points, and whether the reader is told about it on the way. All three are the page's own fields:
 * the title is the page's, and the other two are its content, as JSON. See `helpers/pageRedirect.js`.
 *
 * What the page then DOES with that is `PageRedirect.vue`, which is what the page view draws in place
 * of an article.
 */

// STORES

const editorStore = useEditorStore()
const pageStore = usePageStore()

// I18N

const { t } = useI18n()

// DATA

/**
 * The redirection being edited, which is also exactly what gets saved — the form has no field that is
 * not one of these three. Seeded from the stored content and written back by the watcher below.
 */
const state = reactive(parseRedirect(pageStore.content))

// WATCHERS

/*
  The form IS the content, so the store follows it on every keystroke — there is nothing here that a
  save would collect afterwards.

  Immediate, and deliberately not a change: this also writes the canonical spelling of what was
  already stored, and seeds a page being created with an empty redirection. Neither is an edit, so
  neither may set the unsaved-changes flag — `touch` is called by the handlers instead, where a
  person actually did something.
*/
watch(
  state,
  (value) => {
    pageStore.content = serializeRedirect(value)
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

function setShowInterstitial(showInterstitial) {
  state.showInterstitial = showInterstitial
  touch()
}

/**
 * Picks where this page sends its reader: a page of this wiki, or any URL.
 *
 * One dialog for both, because they are one question — the link picker asks it the way the rest of the
 * app already asks it, and answers with which of its two tabs the answer came from. That is what
 * `kind` is: the choice somebody made, rather than a guess made afterwards from the look of the
 * string. It opens on the current target, so coming back starts from what is already set.
 *
 * Its "open in a new tab" offer is turned off. A redirection is not a link somebody clicks — the
 * reader is taken there — so there is no tab to choose, and nowhere here to store the answer.
 */
function chooseTarget() {
  dialog({
    component: defineAsyncComponent(() => import('./LinkPickerDialog.vue')),
    componentProps: {
      title: t('editor.redirect.pickerTitle'),
      okLabel: t('common.actions.select'),
      initialHref: state.target,
      newTabOption: false
    }
  }).onOk(({ href, kind }) => {
    state.kind = kind === 'url' ? 'url' : 'page'
    state.target = href
    touch()
  })
}
</script>

<style lang="scss">
.editor-redirect {
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

  /*
    Lined up with the main section of the row above it: `w-item` pads 16px and its avatar section is
    56px wide, so the field starts where that row's label does.
  */
  &-field {
    padding: 0 16px 8px 72px;
  }

  &-target {
    display: flex;
    align-items: center;
    overflow-wrap: anywhere;
  }

  /*
    The one line that says what a reader arriving at this page gets. Blue while the form is answerable
    and amber while it is not -- the second is a warning about a save that will be refused, not an
    error that has happened yet.
  */
  &-summary {
    display: flex;
    align-items: flex-start;
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 0.8rem;
    line-height: 1.4;

    &.is-ready {
      background-color: rgba(25, 118, 210, 0.1);
      color: $blue-9;

      @at-root .body--dark &.is-ready {
        color: $blue-3;
      }
    }
    &.is-incomplete {
      background-color: rgba(255, 152, 0, 0.12);
      color: $orange-9;

      @at-root .body--dark &.is-incomplete {
        color: $orange-3;
      }
    }
  }
}
</style>
