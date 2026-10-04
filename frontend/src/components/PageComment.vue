<template>
  <div class="page-comment" :class="{ 'is-reply': Boolean(comment.parentId) }">
    <div class="page-comment-avatar">
      <w-avatar :size="comment.parentId ? `28px` : `36px`" :color="avatarColor" text-color="white">
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
        <span class="text-caption text-grey-6">{{ relativeDate(comment.createdAt) }}</span>
        <!-- -> Only when it is actually true of this comment, and without repeating the date: what
             a reader needs to know is that what they are reading is not what was first posted -->
        <span class="text-caption text-grey-6" v-if="wasEdited">
          &middot; {{ t('common.comments.edited') }}
        </span>
      </div>
      <page-comment-editor
        class="pt-2"
        v-if="editing"
        v-model="draft"
        cancelable
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
        <div class="flex flex-wrap items-center gap-1 pt-1">
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
          <w-btn
            v-if="canEdit"
            size="sm"
            padding="none xs"
            flat
            no-caps
            color="grey"
            icon="la:pen"
            :label="t(`common.actions.edit`)"
            @click="$emit(`edit`, comment)" />
          <w-btn
            v-if="canDelete"
            size="sm"
            padding="none xs"
            flat
            no-caps
            color="grey"
            icon="la:trash"
            :label="t(`common.actions.delete`)"
            @click="$emit(`delete`, comment)" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { relativeDate } from '@/helpers/datetime'
import { avatarColorFor } from '@/helpers/avatarColors'
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
  busy: {
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

defineEmits(['reply', 'edit', 'cancel-edit', 'save', 'delete'])

// I18N

const { t } = useI18n()

// DATA

const draft = ref('')

// COMPUTED

const rendered = computed(() => renderComment(props.comment.content, props.mentions))

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

// WATCHERS

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

  display: flex;
  gap: 12px;
  padding: 12px var(--comment-pad-x);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background-color: #fff;
  color: #26292e;

  @at-root .body--dark & {
    /* -> Opaque, the same shade a translucent white would make over the Talk view's `$dark-3`: each
          reply draws its branch and the trunk past it over the same stretch, and a translucent line
          doubled up wherever the two overlap */
    --thread-line: #{color-mix(in srgb, #fff 14%, $dark-3)};
    border-color: rgba(255, 255, 255, 0.06);
    background-color: $dark-2;
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

.page-comment-avatar {
  flex: none;
  padding-top: 2px;
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
</style>
