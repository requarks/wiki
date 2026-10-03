<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="width: 480px; max-width: 90vw">
      <w-card-header>{{ t('editor.markup.imageProperties') }}</w-card-header>
      <w-card-section class="flex flex-col gap-4">
        <!--
          What the address currently points at, so that picking a different file -- or mistyping one --
          shows up here rather than only in the preview pane behind the dialog.
        -->
        <div
          class="flex h-32 items-center justify-center overflow-hidden rounded bg-black/5 dark:bg-white/5">
          <img
            v-if="state.previewSrc && !state.previewFailed"
            :key="state.previewSrc"
            :src="state.previewSrc"
            alt=""
            class="max-h-full max-w-full object-contain"
            @load="onPreviewLoad"
            @error="onPreviewError" />
          <div
            v-else-if="state.previewFailed"
            class="text-caption text-black/60 dark:text-white/70">
            {{ t('editor.markup.image.previewFailed') }}
          </div>
          <w-icon v-else name="mdi:image-outline" size="48px" class="opacity-30" />
        </div>

        <w-input
          v-model="state.src"
          :label="t('editor.markup.image.src')"
          :rules="[srcRule]"
          hide-bottom-space
          spellcheck="false">
          <template #append>
            <w-btn
              flat
              dense
              round
              icon="mdi:folder-image"
              color="primary"
              :aria-label="t('editor.markup.image.browse')"
              @click="browse">
              <w-tooltip>{{ t('editor.markup.image.browse') }}</w-tooltip>
            </w-btn>
          </template>
        </w-input>

        <w-input
          v-model="state.alt"
          :label="t('editor.visual.image.alt')"
          :hint="t('editor.visual.image.altHint')"
          autofocus />

        <div class="flex items-start gap-3">
          <w-input
            class="flex-1"
            v-model="state.width"
            :label="t('editor.visual.image.width')"
            :rules="[sizeRule]"
            hide-bottom-space
            spellcheck="false" />
          <w-input
            class="flex-1"
            v-model="state.height"
            :label="t('editor.visual.image.height')"
            :rules="[sizeRule]"
            hide-bottom-space
            spellcheck="false" />
        </div>
        <div class="-mt-2 text-caption text-black/60 dark:text-white/70">
          {{ t('editor.visual.image.sizeHint') }}
          <template v-if="state.naturalWidth > 0">
            <br />
            {{
              t('editor.visual.image.natural', {
                width: state.naturalWidth,
                height: state.naturalHeight
              })
            }}
          </template>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-caption font-medium">{{ t('editor.markup.image.alignment') }}</div>
          <div>
            <w-btn-toggle
              v-model="state.alignment"
              push
              glossy
              no-caps
              toggle-color="primary"
              :aria-label="t('editor.markup.image.alignment')"
              :options="alignmentOptions" />
          </div>
          <div class="text-caption text-black/60 dark:text-white/70">
            {{ t('editor.markup.image.alignHint') }}
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-caption font-medium">{{ t('editor.markup.image.styles') }}</div>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <w-checkbox
              v-for="style of styleOptions"
              :key="style.value"
              v-model="state.styles"
              :val="style.value"
              :label="style.label" />
          </div>
        </div>
      </w-card-section>
      <w-card-actions align="right">
        <w-btn flat :label="t('common.actions.cancel')" @click="onDialogCancel" />
        <w-btn
          unelevated
          color="primary"
          :label="t('common.actions.apply')"
          :disabled="!isValid"
          @click="submit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { debounce } from 'es-toolkit/function'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { fileSrc } from '@/renderers/shared'

/**
 * Everything about an image that is not the page around it: where it loads from, the words that stand
 * in for it, how big it is drawn, where it sits and how it is framed. What the "Image Properties" lens
 * opens in the Markdown and AsciiDoc editors, and the image bar's Edit in the Visual editor -- opened
 * through `useImagePropertiesDialog`, which is also what carries the browse button's trip.
 *
 * Picking a different file is a hand-off rather than a second layer: the file manager is a full-screen
 * overlay, and a dialog left open underneath it would still be listening for Escape. So the browse
 * button closes this dialog with `browse: true` and everything typed so far, and it is opened again
 * with the file that was picked -- or as it was, if nothing was.
 *
 * The alignment is answered as a word -- `center`, `right`, or empty for the default -- rather than
 * as what any one syntax writes for it: markdown spells it as a class, AsciiDoc as `align` and
 * `float`. `helpers/markdownImages.js` and `helpers/asciidocImages.js` each translate, and the Visual
 * editor uses the markdown one. The styles are the `decor-*` classes everywhere, which the content
 * stylesheets define.
 */

// PROPS

const props = defineProps({
  /** The address as the source holds it, which may be relative to the page. */
  src: {
    type: String,
    default: ''
  },
  /** What stands in for the picture. Empty where it is decoration and says nothing. */
  alt: {
    type: String,
    default: ''
  },
  /** The width as the page holds it — a pixel count or a percentage, both as written. */
  width: {
    type: String,
    default: ''
  },
  /** The height, likewise. */
  height: {
    type: String,
    default: ''
  },
  /** `center`, `right`, or empty for an image left where the text puts it. */
  alignment: {
    type: String,
    default: ''
  },
  /**
   * Which of those to offer. An AsciiDoc image written inside a line of text has nothing to centre it
   * with, so it is offered the other two.
   */
  alignments: {
    type: Array,
    default: () => ['', 'center', 'right']
  },
  /** Any of `IMAGE_STYLES`. */
  styles: {
    type: Array,
    default: () => []
  },
  /** The page being edited, which a relative address is resolved against for the preview. */
  pagePath: {
    type: String,
    default: ''
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
  src: props.src,
  alt: props.alt,
  width: props.width,
  height: props.height,
  alignment: props.alignment,
  styles: [...props.styles],
  previewSrc: fileSrc(props.src, props.pagePath),
  previewFailed: false,
  naturalWidth: 0,
  naturalHeight: 0
})

// COMPUTED

/*
  Exactly what `markdown-it-imsize` parses: digits, optionally followed by a percent sign. Anything
  else is not rejected by the plugin so much as ignored by it, and the whole suffix stops being a size.
*/
const SIZE = /^\d+%?$/

const alignmentOptions = computed(() =>
  [
    { label: t('editor.markup.image.alignLeft'), value: '' },
    { label: t('editor.markup.image.alignCenter'), value: 'center' },
    { label: t('editor.markup.image.alignRight'), value: 'right' }
  ].filter((option) => props.alignments.includes(option.value))
)

const styleOptions = computed(() => [
  { label: t('editor.markup.image.styleShadow'), value: 'decor-shadow' },
  { label: t('editor.markup.image.styleBorder'), value: 'decor-border' },
  { label: t('editor.markup.image.styleRounded'), value: 'decor-rounded' }
])

const isValid = computed(
  () =>
    srcRule(state.src) === true && sizeRule(state.width) === true && sizeRule(state.height) === true
)

// METHODS

function srcRule(value) {
  return String(value ?? '').trim() !== '' ? true : t('editor.markup.image.srcRequired')
}

function sizeRule(value) {
  const text = String(value ?? '').trim()
  return text === '' || SIZE.test(text) ? true : t('editor.visual.image.sizeInvalid')
}

function onPreviewLoad(ev) {
  state.naturalWidth = ev.target.naturalWidth
  state.naturalHeight = ev.target.naturalHeight
}

function onPreviewError() {
  state.previewFailed = true
  state.naturalWidth = 0
  state.naturalHeight = 0
}

function values() {
  return {
    src: state.src.trim(),
    // -> A lone space is emptiness, and emptiness is a value: an image that is decoration
    alt: state.alt.trim(),
    width: state.width.trim(),
    height: state.height.trim(),
    alignment: state.alignment,
    styles: [...state.styles]
  }
}

function browse() {
  onDialogOK({ browse: true, ...values() })
}

function submit() {
  onDialogOK({ browse: false, ...values() })
}

// WATCHERS

/*
  Not on every keystroke: each new address is a request, and half an address typed is a 404 the
  preview would flash up between letters.
*/
watch(
  () => state.src,
  debounce((src) => {
    state.previewSrc = fileSrc(src.trim(), props.pagePath)
    state.previewFailed = false
    state.naturalWidth = 0
    state.naturalHeight = 0
  }, 400)
)
</script>
