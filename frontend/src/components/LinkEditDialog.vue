<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 560px; max-width: 90vw">
      <w-card-header>{{ t('editor.visual.link.title') }}</w-card-header>
      <w-card-section class="flex flex-col gap-4">
        <w-input
          v-model="state.text"
          :label="t('editor.visual.link.text')"
          :hint="t('editor.visual.link.textHint')"
          autofocus />

        <!--
          The address, with the picker beside it. Typed directly most of the time -- an author editing
          a link usually knows what they are changing it to -- and browsed when the target is a page of
          this wiki, which is what `LinkPickerDialog` is for and what knows how to build its href.
        -->
        <div class="flex items-end gap-2">
          <w-input
            class="flex-1"
            v-model="state.href"
            :label="t('editor.visual.link.url')"
            spellcheck="false" />
          <w-btn
            flat
            color="primary"
            icon="la:folder-open"
            :label="t('editor.visual.link.browse')"
            no-caps
            @click="browse" />
        </div>

        <w-input
          v-model="state.linkTitle"
          :label="t('editor.visual.link.tooltip')"
          :hint="t('editor.visual.link.tooltipHint')" />

        <!-- -> Written into the page as `{target="_blank"}`, which is what both editors use -->
        <w-checkbox v-model="state.newTab" :label="t('editor.visual.link.newTab')" />
      </w-card-section>
      <w-card-actions align="right">
        <w-btn flat :label="t('common.actions.cancel')" @click="onDialogCancel" />
        <w-btn
          unelevated
          color="primary"
          :label="t('common.actions.apply')"
          :disabled="!state.href.trim()"
          @click="submit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { dialog, dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

import LinkPickerDialog from '@/components/LinkPickerDialog.vue'

/**
 * The three things a link is: the words it is on, where it goes, and what it says on hover.
 *
 * Opened over a link already in the page — see `links.js`, which finds the one the caret is in. The
 * text is here rather than left to be retyped in the document because a link is edited as one object:
 * an author changing where it points very often wants to change what it says in the same breath, and
 * selecting exactly the marked run first is fiddly.
 */

// PROPS

const props = defineProps({
  /** The words the link is on. */
  text: {
    type: String,
    default: ''
  },
  /** Where it goes. */
  href: {
    type: String,
    default: ''
  },
  /** Markdown's link title — what a browser shows as a tooltip. Rarely set, never required. */
  linkTitle: {
    type: String,
    default: ''
  },
  /** Whether the link opens in a new tab, which the page stores as `{target="_blank"}`. */
  newTab: {
    type: Boolean,
    default: false
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  text: props.text,
  href: props.href,
  linkTitle: props.linkTitle,
  newTab: props.newTab
})

// METHODS

/**
 * Pick a page or build a URL with the picker, and take its href.
 *
 * Only the href: the picker also answers with the page's title, and writing that over the text would
 * throw away wording an author chose. It fills the text in only when there is none to lose — a link
 * whose words are empty, which is what a freshly inserted one has.
 */
function browse() {
  dialog({
    component: LinkPickerDialog,
    componentProps: {
      initialHref: state.href,
      okLabel: t('common.actions.select'),
      // -> This dialog asks the question itself, just below; two controls for it would disagree
      newTabOption: false
    }
  }).onOk((result) => {
    state.href = result?.href ?? state.href
    if (!state.text.trim() && result?.title) {
      state.text = result.title
    }
  })
}

function submit() {
  onDialogOK({
    text: state.text.trim(),
    href: state.href.trim(),
    linkTitle: state.linkTitle.trim(),
    newTab: state.newTab
  })
}
</script>
