<template>
  <div class="page-comment-editor">
    <!--
      Write / Preview, as a pair of small toggles rather than a WTabs strip: the strip is a segmented
      control sized for navigating a view, and this switches what one box shows.
    -->
    <div class="flex items-center gap-1 pb-2">
      <w-btn
        size="sm"
        padding="none sm"
        no-caps
        :flat="state.tab !== `write`"
        :outline="state.tab === `write`"
        color="primary"
        :label="t(`common.comments.write`)"
        @click="showWrite" />
      <w-btn
        size="sm"
        padding="none sm"
        no-caps
        :flat="state.tab !== `preview`"
        :outline="state.tab === `preview`"
        color="primary"
        :label="t(`common.comments.preview`)"
        @click="showPreview" />
      <w-space />
      <!--
        Only once it matters. A counter that starts at "8000 left" is a warning about a limit nobody
        is near; what a reader needs is to be told before they lose a paragraph to it.
      -->
      <div
        class="text-caption"
        :class="charsLeft < 0 ? `text-negative` : `text-grey-6`"
        v-if="showCounter">
        {{ t('common.comments.charsLeft', { count: charsLeft }) }}
      </div>
    </div>
    <!--
      `position: relative` so the mention menu can be pinned to the box. The menu is positioned
      against the editor rather than the caret: a popup that follows the caret through a wrapping
      textarea needs a mirrored copy of it to measure against, which is a great deal of machinery for
      a list of eight names.
    -->
    <div class="relative" v-show="state.tab === `write`">
      <w-input
        ref="inputEl"
        type="textarea"
        outlined
        hide-bottom-space
        :rows="rows"
        :model-value="modelValue"
        :placeholder="placeholder"
        :aria-label="placeholder"
        :disable="busy"
        @update:model-value="onInput"
        @keydown="onKeydown" />
      <div class="page-comment-mentions" v-if="state.mentions.length > 0">
        <button
          v-for="(target, idx) of state.mentions"
          :key="target.id"
          type="button"
          class="page-comment-mention"
          :class="{ 'is-active': idx === state.mentionIndex }"
          @mousedown.prevent="pickMention(target)">
          <span class="font-medium">@{{ target.handle }}</span>
          <span class="text-caption text-grey-6">{{ target.name }}</span>
        </button>
      </div>
    </div>
    <div class="page-comment-preview page-comment-body" v-show="state.tab === `preview`">
      <div v-if="modelValue.trim().length > 0" v-html="preview" />
      <div class="text-body2 text-grey-6" v-else>{{ t('common.comments.previewEmpty') }}</div>
    </div>
    <!--
      The two fields a guest has to fill in, under the box rather than over it: what somebody came
      here to do is write, and being asked for a name before they have written anything is a form
      standing between them and the thing they meant to do.
    -->
    <div class="flex flex-wrap gap-2 pt-2" v-if="guest">
      <div class="flex-1" style="min-width: min(220px, 100%)">
        <w-input
          outlined
          dense
          hide-bottom-space
          :model-value="authorName"
          :label="t(`common.comments.fieldName`)"
          :disable="busy"
          @update:model-value="$emit(`update:authorName`, $event)" />
      </div>
      <div class="flex-1" style="min-width: min(220px, 100%)">
        <w-input
          outlined
          dense
          type="email"
          :model-value="authorEmail"
          :label="t(`common.comments.fieldEmail`)"
          :hint="t(`common.comments.fieldEmailHint`)"
          :disable="busy"
          @update:model-value="$emit(`update:authorEmail`, $event)" />
      </div>
    </div>
    <div class="flex items-center gap-2 pt-2">
      <div class="text-caption text-grey-6 hidden sm:block">
        {{ t('common.comments.markdownHint') }}
      </div>
      <w-space />
      <w-btn
        v-if="cancelable"
        flat
        no-caps
        color="grey"
        :label="t(`common.actions.cancel`)"
        :disable="busy"
        @click="$emit(`cancel`)" />
      <w-btn
        unelevated
        no-caps
        color="primary"
        icon="la:comment"
        :label="submitLabel"
        :loading="busy"
        :disable="!canSubmit"
        @click="$emit(`submit`)" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { debounce } from 'es-toolkit/function'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import { renderComment } from '@/renderers/comment'

/**
 * The box a comment is written in: a markdown textarea, a preview of it, and the `@` completion.
 *
 * Used three times over on a talk page — the new comment at the bottom, a reply under a thread, and
 * a comment being edited in place — so everything about which of those it is comes in as a prop and
 * nothing about it is decided here.
 *
 * The preview renders through the same function the comments themselves do, with no mentions
 * resolved: the server is what knows which handles exist, and it has not been asked about this draft.
 * So a mention shows in the preview as the text that was typed and becomes a link once posted, which
 * is the honest answer rather than a guess.
 */
const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: ''
  },
  submitLabel: {
    type: String,
    required: true
  },
  /** Shows the name and email fields, which are required of somebody with no account. */
  guest: {
    type: Boolean,
    default: false
  },
  authorName: {
    type: String,
    default: ''
  },
  authorEmail: {
    type: String,
    default: ''
  },
  /** A reply and an edit can be abandoned; the box at the bottom of the page cannot. */
  cancelable: {
    type: Boolean,
    default: false
  },
  busy: {
    type: Boolean,
    default: false
  },
  rows: {
    type: [String, Number],
    default: 4
  }
})

const emit = defineEmits([
  'update:modelValue',
  'update:authorName',
  'update:authorEmail',
  'submit',
  'cancel'
])

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// DATA

const inputEl = ref(null)

const state = reactive({
  tab: 'write',
  /** The handles offered for the `@` being typed, empty whenever the menu is closed. */
  mentions: [],
  mentionIndex: 0,
  /** Where in the text the `@` of the word being completed sits. */
  mentionStart: -1
})

// COMPUTED

const preview = computed(() => renderComment(props.modelValue))

const maxLength = computed(() => siteStore.comments.maxLength || 8000)
const charsLeft = computed(() => maxLength.value - props.modelValue.length)

/** Shown for the last tenth of the allowance, and from then on. See the template. */
const showCounter = computed(() => charsLeft.value <= maxLength.value / 10)

const canSubmit = computed(() => {
  if (props.busy || props.modelValue.trim().length < 2 || charsLeft.value < 0) {
    return false
  }
  // -> A guest has two more fields to fill in, and the button says so by staying off until they are
  return !props.guest || (props.authorName.trim().length > 0 && props.authorEmail.trim().length > 0)
})

// METHODS

function showWrite() {
  state.tab = 'write'
}

function showPreview() {
  closeMentions()
  state.tab = 'preview'
}

function closeMentions() {
  state.mentions = []
  state.mentionIndex = 0
  state.mentionStart = -1
}

/**
 * The `@word` the caret is sitting in, if it is sitting in one.
 *
 * Read off the element rather than the model, because which word is being completed is a question
 * about the caret and the model does not carry one. The word has to start at the beginning of the
 * text or after a character that is not part of a word — the same rule the renderer matches by, so
 * that what completes here is what resolves there.
 */
function mentionUnderCaret() {
  const el = inputEl.value?.el
  if (!el || el.selectionStart !== el.selectionEnd) {
    return null
  }
  const upToCaret = props.modelValue.slice(0, el.selectionStart)
  const match = /(?:^|[^\w@/])@([A-Za-z0-9_-]{0,32})$/.exec(upToCaret)
  if (!match) {
    return null
  }
  return { query: match[1], start: el.selectionStart - match[1].length - 1 }
}

/**
 * Ask the server which handles start with what has been typed.
 *
 * Debounced, and never asked at all for somebody who is not signed in: the endpoint needs a session,
 * since a list of handles answered to anybody would be a way to enumerate the wiki's users. A guest
 * can still type a handle they know — it resolves when the comment is drawn.
 */
const fetchMentions = debounce(async (query, start) => {
  try {
    const results = await API_CLIENT.get(`sites/${siteStore.id}/comments/mentions`, {
      searchParams: { q: query }
    }).json()
    // -> The caret may have moved on while this was in flight, in which case its answer is stale
    if (state.mentionStart !== start) {
      return
    }
    state.mentions = results ?? []
    state.mentionIndex = 0
  } catch {
    closeMentions()
  }
}, 200)

function onInput(value) {
  emit('update:modelValue', value)
  if (!userStore.authenticated) {
    return
  }
  // -> After the model has been written, so that the caret and the text agree about what was typed
  nextTick(() => {
    const mention = mentionUnderCaret()
    if (!mention) {
      closeMentions()
      return
    }
    state.mentionStart = mention.start
    fetchMentions(mention.query, mention.start)
  })
}

/** Put a handle into the text in place of the `@word` that was being typed. */
function pickMention(target) {
  const el = inputEl.value?.el
  if (!el || state.mentionStart < 0) {
    return
  }
  const before = props.modelValue.slice(0, state.mentionStart)
  const after = props.modelValue.slice(el.selectionStart)
  const inserted = `@${target.handle} `
  emit('update:modelValue', `${before}${inserted}${after}`)
  const caret = before.length + inserted.length
  closeMentions()
  nextTick(() => {
    el.focus()
    el.setSelectionRange(caret, caret)
  })
}

/**
 * The keys the mention menu owns while it is open, and nothing else.
 *
 * `preventDefault` only where the menu actually acts, so that a reader who is not completing
 * anything keeps every key the textarea normally has — Enter above all, which in a comment box is a
 * new line and not a submit.
 */
function onKeydown(ev) {
  if (state.mentions.length < 1) {
    return
  }
  switch (ev.key) {
    case 'ArrowDown':
      ev.preventDefault()
      state.mentionIndex = (state.mentionIndex + 1) % state.mentions.length
      break
    case 'ArrowUp':
      ev.preventDefault()
      state.mentionIndex = (state.mentionIndex - 1 + state.mentions.length) % state.mentions.length
      break
    case 'Enter':
    case 'Tab':
      ev.preventDefault()
      pickMention(state.mentions[state.mentionIndex])
      break
    case 'Escape':
      ev.preventDefault()
      closeMentions()
      break
  }
}

// EXPOSED

defineExpose({
  focus: () => inputEl.value?.focus()
})
</script>

<style lang="scss">
.page-comment-mentions {
  position: absolute;
  z-index: 10;
  left: 8px;
  right: 8px;
  top: calc(100% - 4px);
  max-width: 320px;
  max-height: 240px;
  overflow-y: auto;
  border-radius: 4px;
  background-color: #fff;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);

  .body--dark & {
    background-color: $grey-9;
  }
}

.page-comment-mention {
  display: flex;
  width: 100%;
  align-items: baseline;
  gap: 8px;
  padding: 6px 12px;
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font: inherit;

  &:hover,
  &.is-active {
    background-color: rgba($primary, 0.1);
  }
}

.page-comment-preview {
  min-height: 96px;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.24);
  border-radius: 4px;

  .body--dark & {
    border-color: rgba(255, 255, 255, 0.28);
  }
}
</style>
