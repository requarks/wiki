<template>
  <div class="feedback-markdown-field">
    <!-- -> Write / Preview as a pair of small toggles, as the comment box has them -->
    <div class="flex items-center gap-1 pb-2">
      <div class="text-caption text-grey-7 pe-2" v-if="label">{{ label }}</div>
      <w-btn
        size="sm"
        padding="none sm"
        no-caps
        :flat="state.tab !== `write`"
        :outline="state.tab === `write`"
        color="primary"
        :label="t(`common.comments.write`)"
        @click="state.tab = `write`" />
      <w-btn
        size="sm"
        padding="none sm"
        no-caps
        :flat="state.tab !== `preview`"
        :outline="state.tab === `preview`"
        color="primary"
        :label="t(`common.comments.preview`)"
        @click="state.tab = `preview`" />
      <w-space />
      <div
        class="text-caption"
        :class="charsLeft < 0 ? `text-negative` : `text-grey-6`"
        v-if="charsLeft < 500">
        {{ t('common.comments.charsLeft', { count: charsLeft }) }}
      </div>
    </div>
    <w-input
      v-show="state.tab === `write`"
      ref="inputEl"
      type="textarea"
      outlined
      hide-bottom-space
      :rows="rows"
      :model-value="modelValue"
      :placeholder="placeholder"
      :aria-label="label || placeholder"
      :disable="disable"
      @update:model-value="emit(`update:modelValue`, $event ?? ``)" />
    <div class="feedback-markdown-preview" :class="previewClass" v-show="state.tab === `preview`">
      <div v-if="modelValue.trim().length > 0" v-html="preview" />
      <div class="text-body2 text-grey-6" v-else>{{ t('common.comments.previewEmpty') }}</div>
    </div>
    <div class="text-caption text-grey-6 pt-1" v-if="hint">{{ hint }}</div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { renderIdea } from '@/renderers/feedback'

/**
 * A field of basic markdown, with a preview: an idea's description in the submission form, and the
 * comment a status change is posted with.
 *
 * The comment box (`PageCommentEditor.vue`) without what makes it a comment box — its own submit
 * button, the guest fields and the `@` completion — since here the field is one part of a form that is
 * submitted as a whole. The preview renders the way an idea does (`renderers/feedback.js`), which is
 * also the way a comment does, so it is right for both; `previewClass` is what it is then drawn in.
 */
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  /** What may be written in it, under the field: whether `@handle` mentions anybody differs by use. */
  hint: {
    type: String,
    default: ''
  },
  /** The longest it may be, which the counter warns about once it is within 500 of it. */
  maxLength: {
    type: Number,
    default: 8000
  },
  rows: {
    type: [String, Number],
    default: 6
  },
  disable: {
    type: Boolean,
    default: false
  },
  /**
   * The typography the preview is drawn in, which is that of wherever the text ends up: an idea is a
   * page, so `page-contents`; a status comment is a comment, so `page-comment-body` — whose rules come
   * with the discussion, which is on screen wherever a status can be changed.
   */
  previewClass: {
    type: String,
    default: 'page-contents'
  }
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const state = reactive({
  tab: 'write'
})

const inputEl = ref(null)

const charsLeft = computed(() => props.maxLength - props.modelValue.length)

const preview = computed(() => renderIdea(props.modelValue))

defineExpose({
  focus: () => {
    state.tab = 'write'
    inputEl.value?.focus()
  }
})
</script>

<style lang="scss">
/*
  Basic markdown, drawn: a board's introduction (`PageFeedback.vue`) and its preview in the board
  editor. The comment's typography (`.page-comment-body` in `PageComment.vue`), which is the same
  feature set -- but here rather than borrowed from there, since that stylesheet only arrives with
  the discussion and a board's front page has none. Declared in this file because both places that
  draw it load this component: the editor directly, the board through its submission dialog.
*/
.feedback-prose {
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

    @at-root .body--dark & {
      border-left-color: rgba(255, 255, 255, 0.18);
    }
  }

  code {
    font-family: var(--font-mono, monospace);
    font-size: 0.9em;
  }

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
    color: var(--color-primary);
  }
}

.feedback-markdown-preview {
  min-height: 120px;
  padding: 10px 12px;
  border-radius: 4px;

  @at-root .body--light & {
    border: 1px solid rgba(0, 0, 0, 0.12);
  }
  @at-root .body--dark & {
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
}
</style>
