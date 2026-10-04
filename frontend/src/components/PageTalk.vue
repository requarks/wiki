<template>
  <div class="page-talk">
    <div class="py-6 text-center text-body2 text-grey-6" v-if="state.loading && !state.loaded">
      {{ t('common.comments.loading') }}
    </div>
    <template v-else>
      <div class="py-6 text-center" v-if="threads.length < 1">
        <div class="text-body2 text-grey-6">{{ t('common.comments.none') }}</div>
        <!-- -> Only to somebody who can take it up: to a reader who may not comment here, an
             invitation to be the first is an invitation to a button they do not have -->
        <div class="text-caption text-grey-6 pt-1" v-if="canWrite && isOpen">
          {{ t('common.comments.beFirst') }}
        </div>
      </div>
      <template v-for="thread of threads" :key="thread.id">
        <div class="page-talk-thread">
          <page-comment
            :comment="thread"
            :mentions="state.mentions"
            :can-reply="canWrite && isOpen"
            :can-edit="mayModify(thread)"
            :can-delete="mayModify(thread)"
            :busy="state.busy === thread.id"
            :editing="state.editingId === thread.id"
            @reply="startReply"
            @edit="startEdit"
            @cancel-edit="state.editingId = null"
            @save="saveComment"
            @delete="confirmDelete" />
          <page-comment
            v-for="reply of thread.replies"
            :key="reply.id"
            :comment="reply"
            :mentions="state.mentions"
            :can-reply="canWrite && isOpen"
            :can-edit="mayModify(reply)"
            :can-delete="mayModify(reply)"
            :busy="state.busy === reply.id"
            :editing="state.editingId === reply.id"
            @reply="startReply"
            @edit="startEdit"
            @cancel-edit="state.editingId = null"
            @save="saveComment"
            @delete="confirmDelete" />
          <!--
            The reply box, under the thread it answers rather than under the comment inside it that
            was clicked: replies are one level deep, so every one of them lands at the bottom of this
            thread whichever message prompted it, and putting the box anywhere else would promise a
            nesting that does not exist.
          -->
          <div class="page-talk-reply" v-if="state.replyTo === thread.id">
            <div class="text-caption text-grey-6 pb-1">
              {{ t('common.comments.replyingTo', { name: state.replyToName }) }}
            </div>
            <page-comment-editor
              ref="replyEditor"
              v-model="state.replyDraft"
              v-model:author-name="state.authorName"
              v-model:author-email="state.authorEmail"
              cancelable
              :rows="3"
              :guest="isGuest"
              :busy="state.busy === `reply`"
              :placeholder="t(`common.comments.replyPlaceholder`)"
              :submit-label="t(`common.comments.postReply`)"
              @submit="postComment(thread.id)"
              @cancel="cancelReply" />
          </div>
        </div>
      </template>
      <!--
        The four states the bottom of a talk page can be in, in the order they rule each other out:
        the page is closed to comments, the reader may not write here, they are not signed in on a
        wiki that does not take anonymous ones, or there is a box.
      -->
      <div class="py-4" ref="composeEl">
        <w-banner v-if="!isOpen" :class="bannerClass">
          {{ t('common.comments.closed') }}
        </w-banner>
        <w-banner v-else-if="!canWrite && !isGuest" :class="bannerClass">
          {{ t('common.comments.notAllowed') }}
        </w-banner>
        <div class="text-center py-2" v-else-if="!canWrite">
          <div class="text-body2 text-grey-6">{{ t('common.comments.signInToComment') }}</div>
          <w-btn
            class="mt-3"
            unelevated
            no-caps
            color="primary"
            icon="la:sign-in-alt"
            :label="t(`common.header.login`)"
            :to="`/login`" />
        </div>
        <page-comment-editor
          v-else
          ref="newEditor"
          v-model="state.draft"
          v-model:author-name="state.authorName"
          v-model:author-email="state.authorEmail"
          :guest="isGuest"
          :busy="state.busy === `new`"
          :placeholder="t(`common.comments.newPlaceholder`)"
          :submit-label="t(`common.comments.postComment`)"
          @submit="postComment(null)" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useDark } from '@/composables/dark'
import { confirm } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { apiErrorMessage } from '@/helpers/apiError'
import { scrollBehavior } from '@/helpers/motion'

import PageComment from '@/components/PageComment.vue'
import PageCommentEditor from '@/components/PageCommentEditor.vue'

/**
 * The Talk tab: the discussion of one page, for the built-in comments provider.
 *
 * Mounted beside the article rather than under it (`pages/Index.vue`), which is what separates this
 * from every other provider — a wiki page and its talk page are two views of the same thing, as they
 * are on Wikipedia, and a discussion long enough to be worth having is one nobody would reach by
 * scrolling past the article.
 *
 * **The permissions read here are the PAGE ones**, `userStore.pagePermissions`, which the server
 * refreshed for this path. Not `userStore.can()`: that ORs the group-wide list in and answers "may do
 * this somewhere", where every button below has to mean "may do this here" — the endpoint behind each
 * one asks exactly that.
 */

// COMPOSABLES

const dark = useDark()

// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const replyEditor = ref(null)
/** The bottom of the view -- the box, or whatever stands in for it. See `startNewComment`. */
const composeEl = ref(null)
const newEditor = ref(null)

const state = reactive({
  loading: false,
  loaded: false,
  /** Which box is in flight: `new`, `reply`, or the id of the comment being saved. */
  busy: '',
  comments: [],
  mentions: [],
  draft: '',
  replyTo: null,
  replyToName: '',
  replyDraft: '',
  /**
   * The comment being edited, if any.
   *
   * Held here rather than inside the comment, because only this component knows when an edit is
   * over: a save is a request, and a box that closed itself on submit would throw away what was
   * typed the moment one failed.
   */
  editingId: null,
  /** What a guest fills in. Kept here rather than per box, so it survives moving between them. */
  authorName: '',
  authorEmail: ''
})

// COMPUTED

const isGuest = computed(() => !userStore.authenticated)

const canWrite = computed(() => userStore.pagePermissions.includes('write:comments'))
const canModerate = computed(() => userStore.pagePermissions.includes('manage:comments'))

/** Whether this page takes comments at all — the switch in its own properties dialog. */
const isOpen = computed(() => pageStore.allowComments)

/**
 * Whether there is anything for the New Comment button beside the view to take the reader to: a box,
 * or for a guest on a wiki that wants an account, the invitation to sign in that stands in for one. Not
 * a page closed to comments, nor a reader the page refuses -- the button would lead to a banner saying no.
 */
const canStartComment = computed(() => isOpen.value && (canWrite.value || isGuest.value))

const bannerClass = computed(() =>
  dark.isActive ? 'bg-grey-9 text-grey-4' : 'bg-grey-2 text-grey-8'
)

/**
 * The comments as threads: each top-level one with its replies under it.
 *
 * Assembled here rather than served nested, because the server answers with them flat and ordered by
 * time — which is what keeps a reply beside the comment it answers however long afterwards it was
 * written, and what makes the one level of depth a property of the view rather than of the data.
 */
const threads = computed(() => {
  const byId = new Map()
  const roots = []
  for (const comment of state.comments) {
    if (comment.parentId) {
      continue
    }
    const thread = { ...comment, replies: [] }
    byId.set(comment.id, thread)
    roots.push(thread)
  }
  for (const comment of state.comments) {
    // -> A reply whose parent is not in this page's list cannot happen (they are deleted together),
    //    but dropping one is better than drawing an orphan under the wrong thread
    byId.get(comment.parentId)?.replies.push(comment)
  }
  return roots
})

// WATCHERS

// -> The talk of the page in front of the reader, so moving to another one reloads rather than
//    leaving the previous discussion under the new article
watch(
  () => pageStore.id,
  () => load()
)

// METHODS

/** Whether this reader may edit or delete a given comment. See the note on permissions above. */
function mayModify(comment) {
  if (canModerate.value) {
    return true
  }
  // -> A guest has no session to be recognized by, so "their own" has nothing to mean for them
  return canWrite.value && Boolean(comment.authorId) && comment.authorId === userStore.id
}

async function load() {
  if (!pageStore.id || !siteStore.comments.isBuiltIn) {
    return
  }
  state.loading = true
  try {
    const resp = await API_CLIENT.get(`sites/${siteStore.id}/pages/${pageStore.id}/comments`).json()
    state.comments = resp?.comments ?? []
    state.mentions = resp?.mentions ?? []
    state.loaded = true
    // -> The badge on the tab is the count the page came with, and this is the same number after
    //    whatever has happened since -- from the server's own count rather than from the length of
    //    the list, which is capped
    pageStore.commentsCount = resp?.total ?? state.comments.length
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.comments.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading = false
}

function startEdit(comment) {
  // -> One box at a time, and never two: a reply box open under a comment that is itself being
  //    edited is two drafts of the same thing on screen
  cancelReply()
  state.editingId = comment.id
}

function startReply(comment) {
  state.editingId = null
  // -> A reply always attaches to the thread, so the box opens under it whichever message was
  //    clicked -- but it is addressed to whoever was actually being answered
  state.replyTo = comment.parentId ?? comment.id
  state.replyToName = comment.authorName
  state.replyDraft = ''
  nextTick(() => {
    // -> A ref inside a `v-for` collects into an array, and only one reply box is ever rendered
    const box = Array.isArray(replyEditor.value) ? replyEditor.value[0] : replyEditor.value
    box?.focus()
  })
}

function cancelReply() {
  state.replyTo = null
  state.replyToName = ''
  state.replyDraft = ''
}

async function postComment(parentId) {
  const isReply = Boolean(parentId)
  state.busy = isReply ? 'reply' : 'new'
  try {
    await API_CLIENT.post(`sites/${siteStore.id}/pages/${pageStore.id}/comments`, {
      json: {
        content: isReply ? state.replyDraft : state.draft,
        ...(isReply && { parentId }),
        ...(isGuest.value && {
          authorName: state.authorName,
          authorEmail: state.authorEmail
        })
      }
    }).json()
    if (isReply) {
      cancelReply()
    } else {
      state.draft = ''
    }
    notify({ type: 'positive', message: t('common.comments.postSuccess') })
    await load()
  } catch (err) {
    /*
      The message is worth showing in full here rather than reduced to "could not post": what comes
      back is a cooldown with a number of seconds on it, or a spam refusal, and both are things the
      reader can do something about.
    */
    notify({
      type: 'negative',
      message: t('common.comments.postFailed'),
      caption: apiErrorMessage(err),
      timeout: 10000
    })
  }
  state.busy = ''
}

async function saveComment({ id, content }) {
  state.busy = id
  try {
    await API_CLIENT.put(`sites/${siteStore.id}/comments/${id}`, { json: { content } }).json()
    // -> Only once it has actually been saved. A failure leaves the box open with the text still in
    //    it, which is the whole reason this state is up here rather than inside the comment.
    state.editingId = null
    notify({ type: 'positive', message: t('common.comments.updateSuccess') })
    await load()
  } catch (err) {
    notify({
      type: 'negative',
      message: t('common.comments.updateFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.busy = ''
}

function confirmDelete(comment) {
  confirm({
    title: t('common.comments.deleteConfirmTitle'),
    message: t('common.comments.deleteWarn'),
    persistent: true,
    cancel: true,
    color: 'negative',
    okLabel: t('common.actions.delete')
  }).onOk(async () => {
    state.busy = comment.id
    try {
      await API_CLIENT.delete(`sites/${siteStore.id}/comments/${comment.id}`).json()
      notify({ type: 'positive', message: t('common.comments.deleteSuccess') })
      await load()
    } catch (err) {
      notify({
        type: 'negative',
        message: t('common.comments.deleteFailed'),
        caption: apiErrorMessage(err)
      })
    }
    state.busy = ''
  })
}

/**
 * Brings the box at the bottom into view and puts the caret in it.
 *
 * Scrolled to the middle of the screen rather than left to focus, which would scroll only as far as
 * the textarea's bottom edge -- leaving the Post button and the hint under it below the fold. Focus
 * then holds still so as not to cut the scroll short.
 */
function startNewComment() {
  composeEl.value?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' })
  newEditor.value?.focus({ preventScroll: true })
}

// MOUNTED

onMounted(() => {
  load()
})

// EXPOSED

/* -> For the column beside the view (`pages/Index.vue`), which offers New Comment from there */
defineExpose({
  canStartComment,
  startNewComment
})
</script>

<style lang="scss">
/*
  The ink of the whole talk view, stated here because nothing else states it for this column.

  The article beside it gets its colour from `--content-ink` in `_page-contents.scss`, declared on
  `.page-contents` -- a talk page is not page content and is deliberately not styled by that sheet,
  so it would otherwise inherit whatever the shell happens to leave on `<body>`: legible in the light
  theme and dark-on-dark in the dark one. The two values are the same pair the content sheet uses, so
  the article and its discussion read as one column.
*/
.page-talk {
  max-width: 900px;
  margin-inline: auto;
  color: #26292e;

  @at-root .body--dark & {
    color: rgba(255, 255, 255, 0.87);
  }
}

/* -> Cards now, so threads are told apart by the space between them rather than by a rule */
.page-talk-thread + .page-talk-thread {
  margin-top: 20px;
}

/* -> Stepped in as far as the replies are (`.page-comment.is-reply`), since it is where one will land */
.page-talk-reply {
  padding: 12px 0 4px 48px;

  @media (max-width: $breakpoint-xs-max) {
    padding-left: 24px;
  }
}
</style>
