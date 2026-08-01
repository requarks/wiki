<template>
  <w-page class="inbox-review flex flex-col">
    <!-- ----------------------------------------------------- -->
    <!-- QUEUE -->
    <!-- ----------------------------------------------------- -->
    <template v-if="!state.selected">
      <!--
        `pt-4` on the heading rather than `py-4` on the page, which is where the other sections get it
        from: this page is a flex column whose diff view fills the rest of the card, and padding on the
        container would sit under that too.
      -->
      <div class="w-section-header pt-4">{{ t('inbox.pendingReview') }}</div>
      <div class="p-4">
        <div class="text-body2">{{ t('inbox.pendingReviewInfo') }}</div>
        <w-banner
          v-if="state.submissions.length < 1 && state.loading < 1"
          class="mt-6"
          rounded
          :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
          {{ t('inbox.reviewNone') }}
        </w-banner>
        <w-list v-else class="mt-6" bordered separator>
          <w-item
            v-for="submission of state.submissions"
            :key="submission.id"
            clickable
            @click="openSubmission(submission)">
            <w-item-section avatar>
              <w-avatar color="secondary" text-color="white" rounded>
                <w-icon name="la:file-alt" />
              </w-avatar>
            </w-item-section>
            <w-item-section>
              <w-item-label>
                <strong>{{ submission.page.title }}</strong>
              </w-item-label>
              <w-item-label caption>/{{ submission.page.path }}</w-item-label>
              <w-item-label caption>
                <i18n-t keypath="inbox.reviewSubmittedBy" scope="global">
                  <template #author>
                    <strong>{{ submission.author.name || t('inbox.reviewUnknownAuthor') }}</strong>
                  </template>
                  <template #date>{{ humanizeDate(submission.createdAt) }}</template>
                </i18n-t>
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <div class="flex items-center gap-3">
                <w-badge v-if="submission.author.isGuest" color="grey-7" rounded>
                  {{ t('inbox.reviewGuest') }}
                </w-badge>
                <!-- The page moved on after this was written; see `isStale` on the API side. -->
                <w-badge v-if="submission.isStale" color="warning" rounded>
                  {{ t('inbox.reviewStale') }}
                </w-badge>
                <w-icon name="la:angle-right" color="grey" />
              </div>
            </w-item-section>
          </w-item>
        </w-list>
      </div>
    </template>

    <!-- ----------------------------------------------------- -->
    <!-- ONE SUBMISSION -->
    <!-- ----------------------------------------------------- -->
    <template v-else>
      <div class="flex flex-none flex-wrap items-center gap-2 p-4">
        <w-btn
          class="acrylic-btn"
          flat
          dense
          round
          icon="la:arrow-left"
          color="grey"
          :aria-label="t(`inbox.reviewBack`)"
          @click="closeSubmission">
          <w-tooltip>{{ t(`inbox.reviewBack`) }}</w-tooltip>
        </w-btn>
        <div class="min-w-0 flex-1">
          <div class="text-subtitle1">
            <strong>{{ state.selected.page.title }}</strong>
          </div>
          <div class="text-caption text-grey">
            <i18n-t keypath="inbox.reviewSubmittedBy" scope="global">
              <template #author>
                <strong>{{ state.selected.author.name || t('inbox.reviewUnknownAuthor') }}</strong>
              </template>
              <template #date>{{ humanizeDate(state.selected.createdAt) }}</template>
            </i18n-t>
            <template v-if="state.selected.author.email">
              &middot; {{ state.selected.author.email }}
            </template>
          </div>
        </div>
        <w-btn
          class="acrylic-btn"
          flat
          icon="la:external-link-alt"
          color="grey"
          :label="t(`inbox.reviewViewPage`)"
          no-caps
          :href="`/` + state.selected.page.path"
          target="_blank" />
        <w-btn
          class="acrylic-btn"
          flat
          icon="la:times"
          color="negative"
          :label="t(`inbox.reviewDecline`)"
          no-caps
          @click="rejectSubmission" />
        <w-btn
          unelevated
          icon="la:check"
          color="positive"
          :label="t(`inbox.reviewApprove`)"
          no-caps
          @click="approveSubmission" />
      </div>
      <!--
        A warning rather than a block: the reviewer can see both sides in the diff below and edit the
        result before accepting, which is exactly what a stale suggestion needs.
      -->
      <!-- Literal colour classes: WBanner has no `color` prop, so one would be silently dropped. -->
      <w-banner
        v-if="state.selected.isStale"
        class="mx-4 mb-2 flex-none bg-warning text-black"
        rounded>
        {{ t('inbox.reviewStaleHint') }}
      </w-banner>
      <div class="flex-none px-4 pb-2 text-caption text-grey">
        {{ t('inbox.reviewDiffHint') }}
      </div>
      <!-- The diff itself: current page on the left, the suggestion on the right and editable. -->
      <div ref="diffEl" class="inbox-review-diff" />
    </template>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import * as monaco from 'monaco-editor'

import { MarkdownRenderer } from '@/renderers/markdown'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { confirm } from '@/composables/dialog'

import { useEditorStore } from '@/stores/editor'
import { useSiteStore } from '@/stores/site'

// COMPOSABLES

const dark = useDark()

// ROUTER

const route = useRoute()
const router = useRouter()

// STORES

const editorStore = useEditorStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('inbox.pendingReview')
})

// DATA

/** The queue's own address, which is also this screen with nothing open. */
const REVIEW_PATH = '/_inbox/review'

const state = reactive({
  loading: 0,
  submissions: [],
  /** The submission being reviewed, with both sides of the diff. Null while the queue is showing. */
  selected: null
})

// REFS

const diffEl = ref(null)

/*
  The Monaco instances, deliberately outside `state`: they are large objects with their own internals,
  and making them reactive buys nothing and costs a lot.
*/
let diffEditor = null
let originalModel = null
let modifiedModel = null

// WATCHERS

// -> The URL says which submission is open, so everything follows from it -- including arriving on
//    one directly, which is what a link in a notification will do
watch(() => route.params.submissionId, loadSubmission)

// -> The container only exists once a submission is open, so the editor is built after that render
watch(
  () => state.selected?.id,
  async (id) => {
    if (!id) {
      disposeEditor()
      return
    }
    await nextTick()
    mountEditor()
  }
)

// METHODS

/** The reason the API gave, out of a response ky threw on, or the error's own message. */
async function apiMessage(err) {
  return (
    (await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)) ?? err.message
  )
}

function humanizeDate(val) {
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

async function load() {
  state.loading++
  try {
    // -> The markdown renderer is configured per site (line breaks, typographer, and so on), and that
    //    configuration comes with the editor configs rather than on its own
    if (!editorStore.configIsLoaded) {
      await editorStore.fetchConfigs()
    }
    state.submissions =
      (await API_CLIENT.get(`sites/${siteStore.id}/approvals/submissions`).json()) ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.reviewLoadFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
}

/**
 * The submission the URL names, or none.
 *
 * Driven by the route rather than by the click that got here, so that a link straight to a review
 * behaves exactly like picking it off the queue -- and so the back button walks out of one.
 */
async function loadSubmission(id) {
  if (!id) {
    state.selected = null
    return
  }
  state.loading++
  try {
    state.selected = await API_CLIENT.get(
      `sites/${siteStore.id}/approvals/submissions/${id}`
    ).json()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('inbox.reviewLoadFailed'),
      caption: await apiMessage(err)
    })
    /*
      Reviewed by somebody else already, or never this reviewer's to see. Back to the queue, and with
      `replace` so the dead address does not sit in the history for the back button to return to.
    */
    state.selected = null
    router.replace(REVIEW_PATH)
  }
  state.loading--
}

function openSubmission(submission) {
  router.push(`${REVIEW_PATH}/${submission.id}`)
}

/**
 * Where leaving a review goes back to.
 *
 * The queue, unless the reviewer never came through it: `from=page` is set by the review button on a
 * page view, and returning them to an inbox they did not open would strand them a section away from
 * what they were reading.
 */
function backTarget() {
  if (route.query.from === 'page' && state.selected?.page?.path !== undefined) {
    return `/${state.selected.page.path}`
  }
  return REVIEW_PATH
}

function closeSubmission() {
  router.push(backTarget())
}

/**
 * The diff, as the reviewer works on it.
 *
 * Left is the page as it stands, read-only. Right is the suggestion, and is not: the reviewer can
 * adjust it before accepting, which is what makes a stale or nearly-right suggestion usable. What
 * ends up on the page is whatever the right-hand model says at that moment, which is why approving
 * reads the model rather than the value that was loaded.
 */
function mountEditor() {
  if (!diffEl.value || !state.selected) {
    return
  }
  disposeEditor()

  // -> The markdown editor's theme, defined again here because that component may never have mounted
  monaco.editor.defineTheme('wikijs', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#070a0d',
      'editor.lineHighlightBackground': '#0d1117',
      'editorLineNumber.foreground': '#546e7a',
      'editorGutter.background': '#0d1117'
    }
  })

  originalModel = monaco.editor.createModel(state.selected.pageContent ?? '', 'markdown')
  modifiedModel = monaco.editor.createModel(state.selected.content ?? '', 'markdown')

  diffEditor = monaco.editor.createDiffEditor(diffEl.value, {
    automaticLayout: true,
    fontSize: 14,
    // -> Side by side: this screen exists to compare the two, and an inline diff of prose reads as a
    //    jumble of half-lines
    renderSideBySide: true,
    originalEditable: false,
    readOnly: false,
    scrollBeyondLastLine: false,
    theme: 'wikijs',
    wordWrap: 'on'
  })
  diffEditor.setModel({ original: originalModel, modified: modifiedModel })
}

function disposeEditor() {
  diffEditor?.dispose()
  originalModel?.dispose()
  modifiedModel?.dispose()
  diffEditor = null
  originalModel = null
  modifiedModel = null
}

/** What the reviewer settled on: the right-hand side of the diff as it stands now. */
function reviewedContent() {
  return modifiedModel ? modifiedModel.getValue() : (state.selected?.content ?? '')
}

/**
 * The HTML for what is being approved, produced here for the same reason the editor produces it on
 * every save: the markdown pipeline is a frontend one. Without it the server would have to drive a
 * headless browser, which is an extension most instances do not install.
 *
 * @throws When the source will not render, which is worth stopping for -- approving would otherwise
 *         publish a page whose HTML does not match its source.
 */
function renderReviewed(content) {
  const md = new MarkdownRenderer(editorStore.editors.markdown ?? {})
  return md.render(content)
}

function approveSubmission() {
  confirm({
    title: t('inbox.reviewApprove'),
    message: t('inbox.reviewApproveConfirm', { page: state.selected.page.title }),
    cancel: true,
    okLabel: t('inbox.reviewApprove')
  }).onOk(async () => {
    state.loading++
    try {
      const content = reviewedContent()
      const resp = await API_CLIENT.post(
        `sites/${siteStore.id}/approvals/submissions/${state.selected.id}/approve`,
        { json: { content, render: renderReviewed(content) } }
      ).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('inbox.reviewApproveSuccess')
      })
      const target = backTarget()
      // -> Refreshed before leaving, so the queue behind is right whether or not that is where this
      //    goes; on the way to a page the reload is what the page's own review button will read
      await load()
      router.push(target)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('inbox.reviewApproveFailed'),
        caption: await apiMessage(err)
      })
    }
    state.loading--
  })
}

function rejectSubmission() {
  confirm({
    title: t('inbox.reviewDecline'),
    message: t('inbox.reviewDeclineConfirm'),
    cancel: true,
    color: 'negative',
    okLabel: t('inbox.reviewDecline')
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.post(
        `sites/${siteStore.id}/approvals/submissions/${state.selected.id}/reject`
      ).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('inbox.reviewDeclineSuccess')
      })
      const target = backTarget()
      await load()
      router.push(target)
    } catch (err) {
      notify({
        type: 'negative',
        message: t('inbox.reviewDeclineFailed'),
        caption: await apiMessage(err)
      })
    }
    state.loading--
  })
}

// MOUNTED

onMounted(() => {
  load()
  // -> Whatever the address arrived pointing at, which is nothing at all for the queue itself
  loadSubmission(route.params.submissionId)
})

onBeforeUnmount(disposeEditor)
</script>

<style lang="scss">
.inbox-review {
  /*
    The diff takes whatever is left under the header rather than a fixed height: this page sits in a
    card that already fills the viewport, so a height in pixels would either overflow it or leave a
    gap under it.
  */
  &-diff {
    flex: 1 1 auto;
    min-height: 400px;
    border-top: 1px solid rgba(#fff, 0.1);
  }
}
</style>
