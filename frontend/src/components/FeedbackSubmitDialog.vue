<template>
  <w-dialog v-model="dialogVisible" no-backdrop-dismiss @hide="onDialogHide">
    <!-- -> Not closed by a click outside it, which would lose what was typed; Escape still closes it -->
    <w-card class="feedback-submit" style="width: 640px; max-width: 94vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-bulb.svg" size="sm" class="mr-2" />
        <span>{{ isEdit ? t('common.feedback.editIdea') : t('common.feedback.submitIdea') }}</span>
      </w-card-section>
      <!--
        What the board asks of a submitter before anything is typed (`submitNotice`): where bugs go
        instead, say, or which ideas belong on another site. A band of its own under the header rather
        than inside the step's padding, and on the first step only, which is where a submission starts
        and where an edit never goes. Nothing at all when the board has none.
      -->
      <div
        v-if="submitNoticeHtml && state.step === `title`"
        class="feedback-submit-notice feedback-prose"
        v-html="submitNoticeHtml" />
      <!-- ----------------------- -->
      <!-- Step 1: the title, and what is already on the board like it -->
      <!-- ----------------------- -->
      <w-card-section v-if="state.step === `title`">
        <!--
          No Enter to go on: it would take the reader past the possible duplicates before they had
          appeared, which is the whole point of this step. Continue is the way on, by pointer or Tab.
        -->
        <w-input
          ref="iptTitle"
          outlined
          dense
          hide-bottom-space
          :model-value="state.title"
          :label="t('common.feedback.fieldTitle')"
          @update:model-value="onTitle">
          <!-- -> While the duplicate check is out, so that a list that has not arrived yet is not
                  read as there being nothing like this idea on the board -->
          <template #append>
            <w-spinner v-if="state.searching" size="16px" color="primary" />
          </template>
        </w-input>
        <div class="text-caption text-grey-6 pt-2">{{ t('common.feedback.fieldTitleHint') }}</div>
        <!--
          Possible duplicates, as they come in. Each is the idea itself, voted on right here: the
          point is that a reader who finds their idea already on the board adds their vote to it rather
          than a second copy beside it. Opened in a new tab, so that reading one does not lose what was
          typed here.
        -->
        <div class="feedback-submit-similar" v-if="state.similar.length > 0">
          <div class="feedback-submit-similar-title">
            <w-icon name="la:search" size="sm" />
            <span class="pl-2">{{ t('common.feedback.similarTitle') }}</span>
          </div>
          <div class="feedback-submit-similar-hint">{{ t('common.feedback.similarHint') }}</div>
          <div class="feedback-submit-idea" v-for="idea of state.similar" :key="idea.id">
            <feedback-vote
              :count="idea.upvotes"
              :voted="idea.viewerVoted"
              :disable="!board.voting"
              :settled="!takesVotes(idea.status)"
              :busy="state.voting === idea.id"
              @toggle="vote(idea)" />
            <div class="feedback-submit-idea-body">
              <a class="feedback-submit-idea-title" :href="ideaHref(idea)" target="_blank">{{
                idea.title
              }}</a>
              <div class="feedback-submit-idea-meta">
                <feedback-status-badge :status="idea.status" size="sm" />
                <span v-if="siteStore.comments.isBuiltIn" class="opacity-60">
                  <w-icon name="la:comment" size="xs" />
                  {{ idea.commentsCount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </w-card-section>
      <!-- ----------------------- -->
      <!-- Step 2: the idea itself -->
      <!-- ----------------------- -->
      <w-card-section v-else class="flex flex-col gap-4">
        <w-input
          ref="iptFormTitle"
          outlined
          dense
          hide-bottom-space
          :model-value="state.title"
          :label="t('common.feedback.fieldTitle')"
          @update:model-value="state.title = ($event ?? ``).slice(0, TITLE_MAX)" />
        <feedback-markdown-field
          v-model="state.content"
          :label="t('common.feedback.fieldDescription')"
          :placeholder="t('common.feedback.fieldDescriptionHint')"
          :hint="t('common.feedback.markdownHint')"
          :max-length="CONTENT_MAX" />
        <w-select
          v-if="offersCategories"
          outlined
          dense
          multiple
          use-chips
          emit-value
          map-options
          hide-bottom-space
          :label="t('common.feedback.fieldCategories')"
          :options="categoryOptions"
          v-model="state.categories" />
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-btn
          v-if="state.step === `form` && !isEdit"
          class="acrylic-btn"
          flat
          icon="la:arrow-left"
          :label="t('common.feedback.back')"
          color="cancel"
          padding="xs md"
          @click="state.step = `title`" />
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          v-if="state.step === `title`"
          unelevated
          icon="la:arrow-right"
          :label="t('common.feedback.continue')"
          color="primary"
          padding="xs md"
          :disable="state.title.trim().length < 1"
          @click="next" />
        <w-btn
          v-else
          unelevated
          icon="la:check"
          :label="isEdit ? t('common.actions.save') : t('common.feedback.submit')"
          color="primary"
          padding="xs md"
          :loading="state.busy"
          :disable="!canSubmit"
          @click="submit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { debounce } from 'es-toolkit/function'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { toggleVote } from '@/composables/feedback'
import { notify } from '@/composables/notify'

import { apiErrorMessage } from '@/helpers/apiError'
import { takesVotes } from '@/helpers/pageFeedback'
import { renderBoardIntro, renderIdea } from '@/renderers/feedback'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import FeedbackMarkdownField from '@/components/FeedbackMarkdownField.vue'
import FeedbackStatusBadge from '@/components/FeedbackStatusBadge.vue'
import FeedbackVote from '@/components/FeedbackVote.vue'

/** As long a title as the page's column holds. Mirrors `IDEA_TITLE_MAX_LENGTH` in `api/feedback.ts`. */
const TITLE_MAX = 255

/** As long a description as a comment may be. Mirrors `IDEA_CONTENT_MAX_LENGTH`. */
const CONTENT_MAX = 8000

/** How many characters of a title before it is worth asking what is like it. */
const SIMILAR_MIN_LENGTH = 3

/**
 * Submitting an idea to a feedback board, or editing one's own.
 *
 * **Two steps for a submission.** First a title and nothing else, with the ideas already on the board
 * that look like it listed underneath as it is typed — each with a working vote button — because the
 * best outcome for a board is the reader finding their idea there already and voting for it. Continue
 * is always on offer, since only the reader can tell whether a match is really their idea. Then the
 * form: the title again, a description in basic markdown, and the board's categories where it lets a
 * submitter pick them -- or always, for a moderator of the board, who is who files them otherwise.
 *
 * **An edit is the second step alone**, opened from the idea itself by its author while it is still
 * open, or by a moderator at any status (`api/feedback.ts` holds them to that).
 *
 * Not the page editor: somebody proposing an idea should not have to know about properties, paths,
 * publish states or where in the tree to save. The server works all of that out. The description is
 * rendered here, as every page's is in the browser that changed it — see `renderers/feedback.js`.
 */
const props = defineProps({
  /**
   * `{ path, locale, categories, submitterCategories, voting, submitNotice }` of the board being
   * submitted to. `submitNotice` is only read on a submission's first step, so an edit may leave it out.
   */
  board: {
    type: Object,
    required: true
  },
  /** `{ id, title, content, categories }` of the idea being edited. Absent for a submission. */
  idea: {
    type: Object,
    default: null
  },
  /**
   * The reader holds `review:pages` or `manage:pages` on the board, and so files ideas into its
   * categories: offered them regardless of whether the board lets submitters pick.
   */
  moderator: {
    type: Boolean,
    default: false
  }
})

defineEmits(dialogComponentEmits)

const iptTitle = ref(null)
const iptFormTitle = ref(null)

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptTitle.value ?? iptFormTitle.value
})

// ROUTER

const router = useRouter()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  step: props.idea ? 'form' : 'title',
  title: props.idea?.title ?? '',
  content: props.idea?.content ?? '',
  categories: [...(props.idea?.categories ?? [])],
  similar: [],
  /** A duplicate check is on its way to the server. */
  searching: false,
  voting: null,
  busy: false
})

// COMPUTED

const isEdit = computed(() => Boolean(props.idea))

/** The board's notice as HTML, or empty for a board with none. Written by the board, as its intro is. */
const submitNoticeHtml = computed(() =>
  props.board.submitNotice?.trim() ? renderBoardIntro(props.board.submitNotice) : ''
)

const offersCategories = computed(
  () => (props.board.submitterCategories || props.moderator) && props.board.categories.length > 0
)

const categoryOptions = computed(() =>
  props.board.categories.map((category) => ({ value: category.tag, label: category.label }))
)

const canSubmit = computed(
  () =>
    state.title.trim().length > 0 &&
    state.content.trim().length > 0 &&
    state.content.length <= CONTENT_MAX
)

// METHODS

function ideaHref(idea) {
  return `${siteStore.localeUrlPrefix(props.board.locale)}/${idea.path}`
}

/**
 * Which duplicate check is the latest. Each one takes a number, and only the latest may say the
 * search is over: an older one answering late must not take the spinner away while a newer one is
 * still out -- nor put its list up, which the title check below already sees to.
 */
let searchSeq = 0

const findSimilar = debounce(async (title) => {
  const seq = ++searchSeq
  if (title.length < SIMILAR_MIN_LENGTH) {
    state.similar = []
    state.searching = false
    return
  }
  state.searching = true
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/feedback/similar`, {
      searchParams: { path: props.board.path, locale: props.board.locale, title }
    }).json()
    // -> Dropped when the title has moved on since: a slow answer for an older one is not about it
    if (state.title.trim() === title) {
      state.similar = resp.ideas ?? []
    }
  } catch (err) {
    // -> A duplicate check that cannot run is no reason to stop somebody submitting
    console.warn(err)
  } finally {
    if (seq === searchSeq) {
      state.searching = false
    }
  }
}, 300)

function onTitle(value) {
  state.title = (value ?? '').slice(0, TITLE_MAX)
  findSimilar(state.title.trim())
}

async function next() {
  if (state.title.trim().length < 1) {
    return
  }
  findSimilar.cancel()
  // -> Whatever is still out answers into a step that is no longer on screen
  searchSeq++
  state.searching = false
  state.step = 'form'
  await nextTick()
  iptFormTitle.value?.focus()
}

async function vote(idea) {
  state.voting = idea.id
  try {
    await toggleVote(siteStore.id, idea)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.feedback.voteFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.voting = null
  }
}

async function submit() {
  if (!canSubmit.value) {
    return
  }
  state.busy = true
  const body = {
    title: state.title.trim(),
    content: state.content,
    render: renderIdea(state.content),
    ...(offersCategories.value && { categories: state.categories })
  }
  try {
    if (isEdit.value) {
      await API_CLIENT.patch(`sites/${siteStore.id}/feedback/ideas/${props.idea.id}`, {
        json: body
      }).json()
      await pageStore.pageLoad({ id: props.idea.id })
      notify({ type: 'positive', message: t('common.feedback.ideaSaved') })
      onDialogOK()
    } else {
      const resp = await API_CLIENT.post(`sites/${siteStore.id}/feedback/ideas`, {
        json: { ...body, path: props.board.path, locale: props.board.locale }
      }).json()
      notify({ type: 'positive', message: t('common.feedback.ideaSubmitted') })
      onDialogOK()
      router.push(`${siteStore.localeUrlPrefix(props.board.locale)}/${resp.path}`)
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: isEdit.value
        ? t('common.feedback.ideaSaveFailed')
        : t('common.feedback.submitFailed'),
      caption: apiErrorMessage(err)
    })
  } finally {
    state.busy = false
  }
}
</script>

<style lang="scss">
.feedback-submit {
  /*
    A band across the card, flush under the header and edge to edge, closed off from the form by a
    rule: the board's word before the form's. Tinted in the theme's warning colour rather than the
    similar-ideas panel's blue, so that it reads as the board asking something of the submitter, and
    so that a re-themed site recolours it too. Its text lines up with the fields, padded as a card
    section is.
  */
  &-notice {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-warning);
    background-color: color-mix(in srgb, var(--color-warning) 10%, transparent);
    font-size: 0.875rem;
  }

  &-similar {
    margin-top: 16px;
    padding: 12px;
    border-radius: 6px;

    @at-root .body--light & {
      background-color: rgba(25, 118, 210, 0.07);
    }
    @at-root .body--dark & {
      background-color: rgba(100, 181, 246, 0.1);
    }

    &-title {
      display: flex;
      align-items: center;
      font-weight: 500;
    }

    &-hint {
      margin: 2px 0 10px;
      font-size: 0.8rem;
      opacity: 0.7;
    }
  }

  &-idea {
    display: flex;
    align-items: center;
    gap: 12px;

    /*
      A hairline between two suggestions, in the panel's own blue a shade deeper rather than a grey,
      so that it reads as part of the panel it divides. Spaced evenly either side of it.
    */
    & + & {
      margin-top: 8px;
      padding-top: 8px;

      @at-root .body--light & {
        border-top: 1px solid rgba(25, 118, 210, 0.18);
      }
      @at-root .body--dark & {
        border-top: 1px solid rgba(100, 181, 246, 0.2);
      }
    }

    &-body {
      display: flex;
      min-width: 0;
      flex-direction: column;
      gap: 4px;
    }

    &-title {
      font-weight: 500;
      color: var(--color-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    &-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
    }
  }
}
</style>
