<template>
  <div class="page-comment" :class="{ 'is-reply': Boolean(comment.parentId) }">
    <div class="page-comment-avatar">
      <w-avatar :size="comment.parentId ? `28px` : `36px`" color="primary" text-color="white">
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
  Stated again here rather than left to `.page-talk`, so that a comment drawn anywhere else -- a
  moderation screen, a notification -- carries its own ink. See the note in `PageTalk.vue`.
*/
.page-comment {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  color: #26292e;

  @at-root .body--dark & {
    color: rgba(255, 255, 255, 0.87);
  }

  &.is-reply {
    padding-left: 24px;
    border-left: 2px solid rgba(0, 0, 0, 0.08);
    margin-left: 18px;

    @at-root .body--dark & {
      border-left-color: rgba(255, 255, 255, 0.12);
    }
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
    padding: 1px 4px;
    border-radius: 3px;
    background-color: rgba(0, 0, 0, 0.06);
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;

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

    code {
      padding: 0;
      background: none;
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
