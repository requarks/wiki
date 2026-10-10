<template>
  <!-- -> The id is what the view scrolls to once a comment has been posted from the annotator -->
  <div
    class="page-comment"
    :id="`comment-${comment.id}`"
    :class="{ 'is-reply': Boolean(comment.parentId), 'is-deleted': comment.isDeleted }">
    <!--
      What is left of a deleted comment that has replies: a note in its place, so the replies under it
      still read as answers to something. Nothing of the comment is served to draw here -- no author,
      no text. The one action is a moderator's: taking the whole thread, which is all that is left of
      it to delete.
    -->
    <div class="page-comment-main">
      <template v-if="comment.isDeleted">
        <div class="page-comment-avatar">
          <w-avatar size="36px" color="grey-3" text-color="grey-6">
            <w-icon name="la:comment-slash" />
          </w-avatar>
        </div>
        <div class="page-comment-deleted">{{ t('common.comments.deleted') }}</div>
      </template>
      <template v-else>
        <div class="page-comment-avatar">
          <w-avatar
            :size="comment.parentId ? `28px` : `36px`"
            :color="avatarColor"
            text-color="white">
            <img v-if="comment.authorHasAvatar" :src="`/_user/${comment.authorId}/avatar`" alt="" />
            <span v-else>{{ initial }}</span>
          </w-avatar>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-baseline gap-x-2">
            <!--
          A link only where there is a profile to open. A guest has no account behind the name, and
          neither has a comment whose author was deleted -- in both cases the name is a copy the row
          kept, and nothing is there to link to.
        -->
            <router-link
              v-if="comment.authorId"
              class="text-body2 font-medium page-comment-author"
              :to="`/_user/${comment.authorId}`">
              {{ comment.authorName }}
            </router-link>
            <span class="text-body2 font-medium" v-else>{{ comment.authorName }}</span>
            <span class="text-caption text-grey-6" v-if="comment.authorHandle">
              @{{ comment.authorHandle }}
            </span>
            <w-chip v-if="comment.isGuest" size="xs" color="grey-4" text-color="grey-8">
              {{ t('common.comments.guest') }}
            </w-chip>
            <!--
              When, at the far end of the line: who said it is what the eye looks for first, and the
              date is what it checks afterwards. Relative, with the moment itself on hover -- "3 days
              ago" is what a discussion is read by, and the exact time is what settles an argument
              about which came first.
            -->
            <span class="page-comment-when text-caption text-grey-6">
              <time :datetime="comment.createdAt">
                {{ relativeDate(comment.createdAt) }}
                <w-tooltip>{{ fullDate }}</w-tooltip>
              </time>
              <!-- -> Only when it is actually true of this comment, and without repeating the date: what
                   a reader needs to know is that what they are reading is not what was first posted -->
              <span v-if="wasEdited"> &middot; {{ t('common.comments.edited') }}</span>
            </span>
          </div>
          <page-comment-editor
            class="pt-2"
            v-if="editing"
            v-model="draft"
            cancelable
            :allow-empty="hasAnnotations"
            :rows="3"
            :busy="busy"
            :submit-label="t(`common.comments.updateComment`)"
            @submit="$emit(`save`, { id: comment.id, content: draft })"
            @cancel="$emit(`cancel-edit`)" />
          <template v-else>
            <!--
          `v-html` on output this app rendered a moment ago, from markdown with raw HTML disabled --
          see `renderers/comment.js`, where that is the whole security boundary. Nothing stored is
          HTML, so there is no older sanitizer's work being trusted here.
        -->
            <div class="page-comment-body" v-html="rendered" />
            <!--
          The passages of the article this comment is about, each with its note. A resolved one stays,
          dimmed and struck through: it is part of what was said, and the thread may still be talking
          about it.
        -->
            <ol class="page-comment-annotations" v-if="hasAnnotations">
              <li
                v-for="annotation of comment.annotations"
                :key="annotation.id"
                class="page-comment-annotation"
                :class="{ 'is-resolved': Boolean(annotation.resolvedAt) }">
                <div class="min-w-0 flex-1">
                  <div class="page-annotation-quote">{{ annotation.anchor.exact }}</div>
                  <div v-if="editingAnnotationId === annotation.id">
                    <w-input
                      type="textarea"
                      outlined
                      dense
                      hide-bottom-space
                      :rows="2"
                      :aria-label="t(`common.comments.annotationNotePlaceholder`)"
                      :disable="annotationBusy === annotation.id"
                      v-model="noteDraft" />
                    <div class="flex justify-end gap-1 pt-1">
                      <w-btn
                        flat
                        no-caps
                        size="sm"
                        padding="none sm"
                        color="grey"
                        :label="t(`common.actions.cancel`)"
                        :disable="annotationBusy === annotation.id"
                        @click="$emit(`cancel-annotation-edit`)" />
                      <w-btn
                        unelevated
                        no-caps
                        size="sm"
                        padding="none sm"
                        color="primary"
                        :label="t(`common.actions.save`)"
                        :loading="annotationBusy === annotation.id"
                        :disable="noteDraft.trim().length < 1"
                        @click="$emit(`save-annotation`, { id: annotation.id, note: noteDraft })" />
                    </div>
                  </div>
                  <template v-else>
                    <div
                      class="page-comment-body page-comment-annotation-note"
                      v-html="renderComment(annotation.note, mentions)" />
                    <div class="flex flex-wrap items-center gap-1 pt-1">
                      <span
                        class="page-comment-annotation-state text-caption"
                        v-if="annotation.resolvedAt">
                        <w-icon name="la:check-circle" size="1.1em" />
                        {{
                          annotation.resolvedByName
                            ? t('common.comments.annotationResolvedBy', {
                                name: annotation.resolvedByName
                              })
                            : t('common.comments.annotationResolved')
                        }}
                      </span>
                      <w-btn
                        v-if="canResolve"
                        size="sm"
                        padding="none xs"
                        flat
                        no-caps
                        :color="annotation.resolvedAt ? `grey` : `positive`"
                        :icon="annotation.resolvedAt ? `la:undo` : `la:check`"
                        :label="
                          annotation.resolvedAt
                            ? t(`common.comments.annotationReopen`)
                            : t(`common.comments.annotationResolve`)
                        "
                        :disable="annotationBusy === annotation.id"
                        @click="toggleResolved(annotation)" />
                      <w-btn
                        v-if="canEditNotes"
                        size="sm"
                        padding="none xs"
                        flat
                        no-caps
                        color="grey"
                        icon="la:pen"
                        :label="t(`common.actions.edit`)"
                        :disable="annotationBusy === annotation.id"
                        @click="$emit(`edit-annotation`, annotation)" />
                      <w-btn
                        v-if="canResolve"
                        size="sm"
                        padding="none xs"
                        flat
                        no-caps
                        color="grey"
                        icon="la:trash"
                        :label="t(`common.actions.delete`)"
                        :disable="annotationBusy === annotation.id"
                        @click="$emit(`delete-annotation`, annotation)" />
                    </div>
                  </template>
                </div>
                <!--
              Over to the passage in the article. A different icon where the passage can no longer be
              found, decided before the click rather than after it, so a reader can see at a glance
              which remarks are about text that has since changed.
            -->
                <w-btn
                  class="page-comment-annotation-goto"
                  flat
                  round
                  dense
                  size="sm"
                  :color="isLost(annotation) ? `grey` : `primary`"
                  :icon="isLost(annotation) ? `la:unlink` : `la:arrow-right`"
                  :aria-label="
                    isLost(annotation)
                      ? t(`common.comments.annotationLostTitle`)
                      : t(`common.comments.annotationGoTo`)
                  "
                  @click="$emit(`locate-annotation`, annotation)">
                  <w-tooltip anchor="center left" self="center right">
                    {{
                      isLost(annotation)
                        ? t('common.comments.annotationLostTitle')
                        : t('common.comments.annotationGoTo')
                    }}
                  </w-tooltip>
                </w-btn>
              </li>
            </ol>
          </template>
        </div>
      </template>
    </div>
    <!--
      What can be done with the comment, in a bar of its own along the bottom of the card rather than
      under the text: the text is what is being read, and the controls are furniture around it. Not
      drawn at all where there is nothing to offer, nor while the comment is being edited -- the box
      in its place carries its own buttons then.
    -->
    <div class="page-comment-footer" v-if="hasActions">
      <!--
        Collapse / Expand, alone at the left end, with its icon over the line the replies hang off --
        it is that line, and what is on it, that the button folds away. See `.page-comment-toggle`.
      -->
      <w-btn
        v-if="replyCount > 0"
        class="page-comment-toggle"
        size="sm"
        padding="none xs"
        flat
        no-caps
        color="grey"
        :icon="repliesCollapsed ? `la:angle-down` : `la:angle-up`"
        :label="
          repliesCollapsed
            ? t(`common.comments.expandReplies`, replyCount)
            : t(`common.comments.collapseReplies`)
        "
        :aria-expanded="repliesCollapsed ? `false` : `true`"
        @click="$emit(`toggle-replies`, comment)" />
      <w-btn
        v-if="comment.isDeleted"
        size="sm"
        padding="none xs"
        flat
        no-caps
        color="grey"
        icon="la:trash"
        :label="t(`common.comments.deleteThread`)"
        :disable="busy"
        @click="$emit(`delete-thread`, comment)" />
      <!--
        Reply at the far right, set apart from the ones before it -- answering is what the bar is
        mostly for, and Edit and Delete are a reader's own business or a moderator's. Those, and the
        link that leads them, are icons alone, with the word in a tooltip and for a screen reader.
      -->
      <template v-else>
        <!-- -> Offered to every reader: whoever can see the comment can point somebody else at it -->
        <w-btn
          size="sm"
          flat
          round
          dense
          color="grey"
          icon="la:link"
          :aria-label="t(`common.comments.copyLink`)"
          @click="copyLink">
          <w-tooltip>{{ t('common.comments.copyLink') }}</w-tooltip>
        </w-btn>
        <w-btn
          v-if="canEdit"
          size="sm"
          flat
          round
          dense
          color="grey"
          icon="la:pen"
          :aria-label="t(`common.actions.edit`)"
          @click="$emit(`edit`, comment)">
          <w-tooltip>{{ t('common.actions.edit') }}</w-tooltip>
        </w-btn>
        <w-btn
          v-if="canDelete"
          size="sm"
          flat
          round
          dense
          color="grey"
          icon="la:trash"
          :aria-label="t(`common.actions.delete`)"
          @click="$emit(`delete`, comment)">
          <w-tooltip>{{ t('common.actions.delete') }}</w-tooltip>
        </w-btn>
        <w-separator v-if="canReply" vertical class="page-comment-footer-sep" />
        <w-btn
          v-if="canReply"
          size="sm"
          padding="none xs"
          flat
          no-caps
          color="primary"
          icon="la:reply"
          :label="t(`common.comments.reply`)"
          @click="$emit(`reply`, comment)" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { notify } from '@/composables/notify'

import { relativeDate } from '@/helpers/datetime'
import { avatarColorFor } from '@/helpers/avatarColors'
import { copyToClipboard } from '@/helpers/clipboard'
import { renderComment } from '@/renderers/comment'

import PageCommentEditor from '@/components/PageCommentEditor.vue'

/**
 * One comment, in the list or being edited in place.
 *
 * Which of the three actions it offers is decided by whoever owns the list -- who may moderate this
 * page, and whose comment this is, are questions about the reader rather than about the comment, so
 * they arrive as props and nothing is worked out here.
 */
const props = defineProps({
  comment: {
    type: Object,
    required: true
  },
  /** The handles that resolved to somebody, for the whole page. See `renderers/comment.js`. */
  mentions: {
    type: Array,
    default: () => []
  },
  canReply: {
    type: Boolean,
    default: false
  },
  canEdit: {
    type: Boolean,
    default: false
  },
  canDelete: {
    type: Boolean,
    default: false
  },
  /** On a deleted comment's placeholder: may take the whole thread under it. A moderator's call. */
  canDeleteThread: {
    type: Boolean,
    default: false
  },
  busy: {
    type: Boolean,
    default: false
  },
  /**
   * Which of its annotations can still be found in the article, by id. One missing from the map has
   * not been looked for yet, and is offered as findable -- the click looks again either way.
   */
  annotationsFound: {
    type: Object,
    default: () => ({})
  },
  /** May resolve, reopen and delete its annotations: the author, `review:pages` or `manage:comments`. */
  canResolve: {
    type: Boolean,
    default: false
  },
  /** May rewrite the notes of its annotations -- the same people who may edit the comment. */
  canEditNotes: {
    type: Boolean,
    default: false
  },
  /** The annotation whose note is being edited, if it is one of these. Owned by the list, as `editing` is. */
  editingAnnotationId: {
    type: String,
    default: null
  },
  /** The annotation a request is out for, if it is one of these. */
  annotationBusy: {
    type: String,
    default: ''
  },
  /** How many replies hang off this comment. Only ever non-zero on the comment that opens a thread. */
  replyCount: {
    type: Number,
    default: 0
  },
  /** Whether those replies are folded away. Owned by the list, which is what draws them. */
  repliesCollapsed: {
    type: Boolean,
    default: false
  },
  /**
   * Whether this comment is the one being edited.
   *
   * Owned by the list rather than by the comment, because only the list knows when an edit is over:
   * a save is a request, and the box has to stay open and keep what was typed when one fails.
   */
  editing: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'reply',
  'edit',
  'cancel-edit',
  'save',
  'delete',
  'delete-thread',
  'toggle-replies',
  'locate-annotation',
  'resolve-annotation',
  'edit-annotation',
  'cancel-annotation-edit',
  'save-annotation',
  'delete-annotation'
])

// I18N

const { t } = useI18n()

// DATA

const draft = ref('')
/** The note of the annotation being edited, as it is being rewritten. */
const noteDraft = ref('')

// COMPUTED

const rendered = computed(() => renderComment(props.comment.content, props.mentions))

/**
 * The moment it was posted, in full, for the tooltip on the relative date. In the reader's own locale,
 * as the relative date beside it is (`helpers/datetime.js`), so the two read as one statement.
 */
const fullDate = computed(() =>
  Temporal.Instant.from(props.comment.createdAt).toLocaleString(undefined, {
    dateStyle: 'full',
    timeStyle: 'short'
  })
)

const hasAnnotations = computed(() => (props.comment.annotations?.length ?? 0) > 0)

/** Whether the footer has anything in it. See the template. */
const hasActions = computed(() => {
  if (props.comment.isDeleted) {
    // -> A placeholder always has replies, but the count is what the toggle itself goes by
    return props.canDeleteThread || props.replyCount > 0
  }
  // -> Copy Link is always there, so only an edit in progress empties it
  return !props.editing
})

/**
 * Whether this comment has been changed since it was posted.
 *
 * A second of slack, because the two timestamps are written by two statements: the row is inserted
 * with both defaulting to `now()`, and a comment that was never touched should not read as edited
 * because those two calls landed on either side of a microsecond.
 */
const wasEdited = computed(() => {
  const created = Temporal.Instant.from(props.comment.createdAt)
  const updated = Temporal.Instant.from(props.comment.updatedAt)
  return created.until(updated).total('seconds') > 1
})

const initial = computed(() => (props.comment.authorName || '?').trim().charAt(0).toUpperCase())

/**
 * One colour per author, so a thread reads as who said what at a glance. An account is keyed on its
 * id, which survives a rename; a guest has no account behind the name, so the name is all there is --
 * the same name posting twice is the same colour, which is also what the reader would assume.
 */
const avatarColor = computed(() =>
  avatarColorFor(
    props.comment.authorId
      ? props.comment.authorId
      : `guest:${(props.comment.authorName || '').trim().toLowerCase()}`
  )
)

// METHODS

/**
 * Put a link to this comment on the clipboard: the page as it is addressed now, with `#comment-<id>`,
 * which opens the page on its Talk view and scrolls to the comment (`viewFromHash` in
 * `pages/Index.vue`). The query is left off -- it says something about this reader's visit, not about
 * the comment.
 */
async function copyLink() {
  const { origin, pathname } = window.location
  try {
    await copyToClipboard(`${origin}${pathname}#comment-${props.comment.id}`)
    notify({ type: 'positive', message: t('common.comments.linkCopied') })
  } catch (err) {
    notify({ type: 'negative', message: err.message })
  }
}

/** Whether an annotation's passage was looked for in the article and not found. */
function isLost(annotation) {
  return props.annotationsFound[annotation.id] === false
}

function toggleResolved(annotation) {
  emit('resolve-annotation', { annotation, resolved: !annotation.resolvedAt })
}

// WATCHERS

// -> As for the comment itself: filled from the note as it stands the moment the box opens
watch(
  () => props.editingAnnotationId,
  (id) => {
    noteDraft.value = props.comment.annotations?.find((a) => a.id === id)?.note ?? ''
  },
  { immediate: true }
)

// -> The box is filled from the comment as it stands the moment it opens, and emptied when it closes
//    so that re-opening it never shows a draft from an edit that was abandoned
watch(
  () => props.editing,
  (isEditing) => {
    draft.value = isEditing ? props.comment.content : ''
  },
  { immediate: true }
)
</script>

<style lang="scss">
/*
  A card: a surface, ink and edge of its own, so that a comment reads the same on the Talk view's grey
  and anywhere else it is drawn -- a moderation screen, a notification. See the note in `PageTalk.vue`.

  A reply is the same card stepped in, hung off a line that comes down from under the parent's avatar
  and branches into each reply at its own avatar -- see `.is-reply` below.
*/
.page-comment {
  /* -> The geometry the thread line is drawn from, so the phone layout changes the numbers only */
  --comment-pad-x: 16px;
  --comment-gap: 8px;
  --reply-indent: 48px;
  --thread-line: #{$grey-4};

  /* -> Where a scroll to the comment stops (`#comment-<id>`, View Comment on an annotation): a little
        way short of the card, so it lands with room above it rather than flush against the top */
  scroll-margin-top: 24px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background-color: #fff;
  /*
    Lifted off the Talk view's grey, just: a tight layer for the edge and a soft one for the drop, both
    faint. Not `--shadow-card`, which is the elevation of a panel -- a page of discussion is a stack
    of these, and that much shadow on every one of them reads as a pile rather than a column.
  */
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 2px 8px rgba(0, 0, 0, 0.04);
  color: #26292e;

  @at-root .body--dark & {
    /* -> Opaque, the same shade a translucent white would make over the Talk view's `$dark-3`: each
          reply draws its branch and the trunk past it over the same stretch, and a translucent line
          doubled up wherever the two overlap */
    --thread-line: #{color-mix(in srgb, #fff 14%, $dark-3)};
    border-color: rgba(255, 255, 255, 0.06);
    background-color: $dark-2;
    /* -> Deeper, since a faint black on a dark ground is nothing at all */
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.3),
      0 2px 8px rgba(0, 0, 0, 0.2);
    color: rgba(255, 255, 255, 0.87);
  }

  & + & {
    margin-top: var(--comment-gap);
  }

  @media (max-width: $breakpoint-xs-max) {
    --comment-pad-x: 12px;
    --reply-indent: 40px;
  }

  /*
    The thread line, drawn by the replies rather than by the parent, since each knows whether it is
    the last one: every reply draws the branch into itself, from the bottom of the card above down to
    its own avatar and round the corner to its edge, and every reply but the last also carries the
    trunk on past itself to the next one.

    Placed in the reply's own border-box terms: the trunk runs down the middle of the parent's 36px
    avatar (`--trunk-x` from the parent's edge, which is the reply's edge less the indent), and the
    branch meets the reply at the middle of its 28px one. The extra pixel either side of each offset is
    the card's border, which an absolutely placed child measures from the inside of.
  */
  &.is-reply {
    --trunk-x: calc(1px + var(--comment-pad-x) + 18px);
    --trunk-left: calc(var(--trunk-x) - var(--reply-indent) - 2px);
    position: relative;
    margin-left: var(--reply-indent);

    &::before {
      content: '';
      position: absolute;
      top: calc(-1px - var(--comment-gap));
      left: var(--trunk-left);
      width: calc(var(--reply-indent) - var(--trunk-x) + 1px);
      /* -> Centred on the middle of the avatar, 29px down: border, padding, `.page-comment-avatar`'s
            2px, half of 28px -- plus one for the line's own half-width below it */
      height: calc(var(--comment-gap) + 30px);
      border-bottom: 2px solid var(--thread-line);
      border-left: 2px solid var(--thread-line);
      border-bottom-left-radius: 10px;
    }
  }

  &.is-reply:has(+ .is-reply)::after {
    content: '';
    position: absolute;
    top: calc(-1px - var(--comment-gap));
    bottom: -1px;
    left: var(--trunk-left);
    border-left: 2px solid var(--thread-line);
  }
}

/*
  The comment a `#comment-<id>` link was followed to, so the reader can tell which card in a column of
  look-alike ones they were sent to. Keyed off the class `helpers/anchors.js` leaves on it, as a
  landed footnote is -- keep the name in step with `LANDED_CLASS` there. A ring rather than a wider
  border, so the card's contents and the thread line drawn from its edge do not move.
*/
.page-comment.is-anchor-landed {
  border-color: var(--q-primary);
  box-shadow: 0 0 0 1px var(--q-primary);
}

.page-comment-main {
  display: flex;
  gap: 12px;
  padding: 12px var(--comment-pad-x);
}

/*
  The actions, along the bottom of the card and gathered at its right end. A shade off the card's own
  surface and a hairline above, so it reads as the card's footer rather than as more of the comment;
  its corners follow the card's, less the border, since the card cannot clip it -- a reply draws its
  thread line outside itself.
*/
.page-comment-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  padding: 3px calc(var(--comment-pad-x) - 6px);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 0 0 7px 7px;
  background-color: rgba(0, 0, 0, 0.025);

  @at-root .body--dark & {
    border-top-color: rgba(255, 255, 255, 0.05);
    background-color: rgba(255, 255, 255, 0.03);
  }
}

/*
  Its icon centred on the thread line, which runs down the middle of the 36px avatar: `--comment-pad-x`
  plus 18px in from the card's inner edge, where the footer's own content starts 6px short of the
  padding. Less the button's 4px padding and half its icon, which is 1.715em wide in the button's own
  font size (`WBtn.vue`) -- so `em` here is the button's, and the sum holds at any size. The auto end
  margin sends everything after it to the far end, where the bar keeps its other actions.
*/
.page-comment-toggle {
  margin-inline-start: calc(24px - 4px - 0.8575em);
  margin-inline-end: auto;
}

.page-comment-footer-sep {
  align-self: stretch;
  margin: 4px 6px;
}

.page-comment-avatar {
  flex: none;
  padding-top: 2px;
}

.page-comment-when {
  margin-inline-start: auto;
  white-space: nowrap;
}

.page-comment-author {
  color: inherit;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

/*
  The typography of a comment, which is deliberately NOT the article's.

  `_page-contents.scss` styles what a page author writes -- headings that join the page outline,
  tables, admonitions -- and a comment has none of that available to it (see `renderers/comment.js`).
  What is left is prose, quotes, lists and code, at the size of the surrounding interface rather than
  of an article.
*/
.page-comment-body {
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;

  > *:first-child {
    margin-top: 0;
  }

  > *:last-child {
    margin-bottom: 0;
  }

  p {
    margin: 0 0 8px;
  }

  ul,
  ol {
    margin: 0 0 8px;
    padding-left: 24px;
    list-style: revert;
  }

  blockquote {
    margin: 0 0 8px;
    padding: 2px 0 2px 12px;
    border-left: 3px solid rgba(0, 0, 0, 0.12);
    color: rgba(0, 0, 0, 0.66);

    @at-root .body--dark & {
      border-left-color: rgba(255, 255, 255, 0.18);
      color: rgba(255, 255, 255, 0.7);
    }
  }

  code {
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
  }

  /*
    The chip is for code in a sentence only. Scoped by selector rather than undone inside a block,
    because the undoing lost: the dark theme's tint is stated through `.body--dark`, which outweighs
    a `pre code` reset, and every line of a block came out with a second background over the block's.
  */
  :not(pre) > code {
    padding: 1px 4px;
    border-radius: 3px;
    background-color: rgba(0, 0, 0, 0.06);

    @at-root .body--dark & {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }

  pre {
    margin: 0 0 8px;
    padding: 8px 10px;
    border-radius: 4px;
    overflow-x: auto;
    background-color: rgba(0, 0, 0, 0.06);

    @at-root .body--dark & {
      background-color: rgba(255, 255, 255, 0.08);
    }
  }

  a {
    color: $primary;
  }

  .comment-mention {
    font-weight: 600;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

/*
  The note a deleted comment leaves for its replies: as tall as the avatar beside it and no taller,
  in grey, so the thread reads on past it. The avatar is a muted circle rather than nothing, because
  the line down to the replies is drawn from where an avatar sits.
*/
.page-comment-deleted {
  flex: 1;
  align-self: center;
  font-size: 14px;
  font-style: italic;
  color: $grey-6;
}

.page-comment.is-deleted .w-avatar {
  @at-root .body--dark & {
    background-color: rgba(255, 255, 255, 0.08) !important;
    color: rgba(255, 255, 255, 0.4) !important;
  }
}

/*
  A comment's annotations, under its text: each passage quoted, the note on it, and the way over to it
  in the article at the far end. Divided by rules rather than boxed, since they are parts of one card.
*/
.page-comment-annotations {
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.page-comment-annotation {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid rgba(0, 0, 0, 0.07);

  @at-root .body--dark & {
    border-top-color: rgba(255, 255, 255, 0.07);
  }

  /*
    Done, and still there to be read: dimmed, with what was quoted and what was said struck through.
    The controls and the line saying who resolved it are not struck -- they are about the annotation,
    not part of it.
  */
  &.is-resolved {
    .page-annotation-quote,
    .page-comment-annotation-note {
      opacity: 0.5;
      text-decoration: line-through;
    }
  }
}

.page-comment-annotation-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-inline-end: 4px;
  color: var(--q-positive);
}

.page-comment-annotation-goto {
  flex: none;
  margin-top: 2px;
}
</style>
