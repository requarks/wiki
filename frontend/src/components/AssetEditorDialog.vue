<template>
  <w-dialog
    class="asset-editor"
    v-model="dialogVisible"
    full-width
    full-height
    persistent
    @hide="onDialogHide">
    <div class="asset-editor-frame">
      <!-- -> What the preview approximates Sharp's sharpen() with; referenced by the canvas's filter -->
      <svg class="absolute" width="0" height="0" aria-hidden="true" focusable="false">
        <filter :id="SHARPEN_FILTER_ID">
          <feConvolveMatrix order="3" kernelMatrix="0 -1 0 -1 5 -1 0 -1 0" preserveAlpha="true" />
        </filter>
      </svg>

      <!-- HEADER -->
      <div class="card-header asset-editor-bar px-4 py-2">
        <w-icon name="la:image" left size="md" />
        <div class="min-w-0">
          <div class="truncate">{{ fileName }}</div>
          <div class="text-caption whitespace-nowrap">{{ caption }}</div>
        </div>
        <w-space />
        <!-- -> The same push group the other editing overlays close with; see `GroupEditOverlay` -->
        <w-btn-group push>
          <w-btn
            push
            color="white"
            text-color="grey-7"
            icon="la:times"
            :label="screen.gte.sm ? t(`common.actions.discard`) : undefined"
            :aria-label="t(`common.actions.discard`)"
            :disable="state.isSaving"
            @click="discard" />
          <w-btn
            push
            color="positive"
            text-color="white"
            icon="la:check"
            :label="screen.gte.sm ? t(`fileman.imageEditorSave`) : undefined"
            :aria-label="t(`fileman.imageEditorSave`)"
            :disable="!hasChanges || isBusy">
            <w-menu anchor="bottom right" self="top right" auto-close>
              <w-list class="p-2" dense style="min-width: 220px">
                <w-item clickable :disabled="!state.info?.maySaveAs" @click="save(`saveAs`)">
                  <w-item-section side>
                    <w-icon name="la:copy" color="primary" />
                  </w-item-section>
                  <w-item-section>{{ t('fileman.imageEditorSaveAsNew') }}</w-item-section>
                  <w-tooltip v-if="!state.info?.maySaveAs">{{
                    t('fileman.imageEditorSaveAsDenied')
                  }}</w-tooltip>
                </w-item>
                <w-item clickable :disabled="!state.info?.mayReplace" @click="save(`replace`)">
                  <w-item-section side>
                    <w-icon name="la:file-image" color="negative" />
                  </w-item-section>
                  <w-item-section>{{ t('fileman.imageEditorReplaceOriginal') }}</w-item-section>
                  <w-tooltip v-if="!state.info?.mayReplace">{{
                    t('fileman.imageEditorReplaceDenied')
                  }}</w-tooltip>
                </w-item>
              </w-list>
            </w-menu>
          </w-btn>
        </w-btn-group>
      </div>

      <div class="asset-editor-body">
        <!-- STAGE -->
        <div ref="stage" class="asset-editor-stage">
          <w-spinner v-if="state.status === `loading`" size="32px" color="grey-5" />
          <!--
            Kept mounted while loading rather than rendered once ready, so that the canvas exists to be
            drawn on by the time the first render runs.
          -->
          <div
            v-show="state.status === `ready`"
            class="asset-editor-canvas"
            :style="{ width: `${display.width}px`, height: `${display.height}px` }">
            <canvas ref="canvas" :style="{ filter: previewFilter }" />
            <div v-if="state.panel === `straighten`" class="asset-editor-grid" />
            <image-region-box
              v-if="hasRegion && state.region"
              v-model="state.region"
              :image-width="size.width"
              :image-height="size.height"
              :aspect="state.panel === `redact` ? null : aspectRatio"
              :grid="state.panel !== `redact`"
              :label="t(`fileman.imageEditorRegion`)" />
          </div>
        </div>

        <!-- SIDEBAR -->
        <!-- -> Dark in both themes, as the stage is: see `.w-dark-surface` in `tailwind.css` -->
        <aside class="asset-editor-sidebar w-dark-surface">
          <!--
            -> Up from the moment it opens, rather than at the save: every edit is to one frame. Over
               the list of actions only, since a panel opens with its own heading band at the top
          -->
          <w-banner
            v-if="state.info?.frames > 1 && !state.panel"
            class="asset-editor-animated mb-3"
            dense>
            <template #avatar>
              <w-icon name="la:exclamation-triangle" color="warning" size="xs" />
            </template>
            <!-- -> Sized here, on the text: the banner sets `text-body2` on the box it is put in. A
                    block, since an inline element cannot set its lines closer than its parent's -->
            <span class="block text-[0.8rem] leading-snug">{{
              t('fileman.imageEditorAnimated')
            }}</span>
          </w-banner>
          <!-- ACTIONS -->
          <template v-if="!state.panel">
            <div class="asset-editor-actions" role="toolbar" :aria-label="t(`fileman.imageEditor`)">
              <button
                v-for="action of actions"
                :key="action.key"
                type="button"
                class="asset-editor-action"
                :disabled="!isReady"
                :title="action.shortcut ? `${action.label} (${action.shortcut})` : action.label"
                @click="action.run">
                <w-icon :name="action.icon" size="sm" />
                <span class="asset-editor-action-label">{{ action.label }}</span>
                <kbd v-if="action.shortcut">{{ action.shortcut }}</kbd>
              </button>
            </div>
            <!-- -> The three that step through the history, together at the foot of the list -->
            <div class="asset-editor-history">
              <button
                type="button"
                class="asset-editor-action"
                :disabled="!canUndo || isBusy"
                :title="`${t('fileman.imageEditorUndo')} (Ctrl+Z)`"
                @click="undo">
                <w-icon name="la:undo" size="sm" />
                <span class="asset-editor-action-label">{{ t('fileman.imageEditorUndo') }}</span>
              </button>
              <button
                type="button"
                class="asset-editor-action"
                :disabled="!canRedo || isBusy"
                :title="`${t('fileman.imageEditorRedo')} (Ctrl+Shift+Z)`"
                @click="redo">
                <w-icon name="la:redo" size="sm" />
                <span class="asset-editor-action-label">{{ t('fileman.imageEditorRedo') }}</span>
              </button>
              <button
                type="button"
                class="asset-editor-action"
                :disabled="!isReady || !hasChanges"
                :title="t('fileman.imageEditorReset')"
                @click="reset">
                <w-icon name="la:history" size="sm" />
                <span class="asset-editor-action-label">{{ t('fileman.imageEditorReset') }}</span>
              </button>
            </div>
          </template>

          <!-- PANEL -->
          <div v-else class="asset-editor-panel">
            <!-- -> The band a dialog opens with, run out to the sidebar's edges as a dialog's is -->
            <w-card-section class="card-header asset-editor-panel-title">
              <w-icon :name="panelAction.icon" size="sm" class="mr-2" />
              <span>{{ panelAction.label }}</span>
            </w-card-section>

            <!-- CROP / TRIM -->
            <template v-if="state.panel === `crop` || state.panel === `trim`">
              <div v-if="state.panel === `trim`" class="asset-editor-field">
                <div class="text-caption">{{ t('fileman.imageEditorTrimTolerance') }}</div>
                <w-slider
                  :model-value="state.trimTolerance"
                  :min="0"
                  :max="50"
                  :step="1"
                  label
                  :aria-label="t(`fileman.imageEditorTrimTolerance`)"
                  @update:model-value="setTrimTolerance" />
                <div class="text-caption text-grey">
                  {{
                    state.region
                      ? t('fileman.imageEditorTrimHint')
                      : t('fileman.imageEditorTrimNothing')
                  }}
                </div>
              </div>
              <div v-else class="asset-editor-field">
                <w-select
                  :model-value="state.aspect"
                  :options="aspectOptions"
                  emit-value
                  map-options
                  outlined
                  dense
                  dark
                  :label="t(`fileman.imageEditorAspect`)"
                  @update:model-value="setAspect" />
              </div>
              <div v-if="state.region" class="asset-editor-field flex flex-nowrap gap-2">
                <w-input
                  class="flex-1"
                  :model-value="String(state.region.width)"
                  type="number"
                  outlined
                  dense
                  suffix="px"
                  :label="t(`fileman.resizeImageWidth`)"
                  @update:model-value="setRegionSize(`width`, $event)" />
                <w-input
                  class="flex-1"
                  :model-value="String(state.region.height)"
                  type="number"
                  outlined
                  dense
                  suffix="px"
                  :label="t(`fileman.resizeImageHeight`)"
                  @update:model-value="setRegionSize(`height`, $event)" />
              </div>
            </template>

            <!-- RESIZE -->
            <template v-else-if="state.panel === `resize`">
              <div class="asset-editor-field flex flex-nowrap items-start gap-2">
                <w-input
                  class="flex-1"
                  :model-value="sizeFields.fields.width"
                  type="number"
                  outlined
                  dense
                  suffix="px"
                  :label="t(`fileman.resizeImageWidth`)"
                  :rules="sizeFields.widthValidation.value"
                  hide-bottom-space
                  @update:model-value="sizeFields.setWidth" />
                <w-btn
                  class="mt-1"
                  flat
                  round
                  dense
                  :icon="sizeFields.fields.isRatioLocked ? `la:lock` : `la:lock-open`"
                  :color="sizeFields.fields.isRatioLocked ? `primary` : `grey`"
                  :aria-pressed="String(sizeFields.fields.isRatioLocked)"
                  :aria-label="t(`fileman.resizeImageLockRatio`)"
                  @click="sizeFields.toggleRatioLock" />
                <w-input
                  class="flex-1"
                  :model-value="sizeFields.fields.height"
                  type="number"
                  outlined
                  dense
                  suffix="px"
                  :label="t(`fileman.resizeImageHeight`)"
                  :rules="sizeFields.heightValidation.value"
                  hide-bottom-space
                  @update:model-value="sizeFields.setHeight" />
              </div>
              <div class="asset-editor-field">
                <w-input
                  :model-value="sizeFields.fields.percent"
                  type="number"
                  outlined
                  dense
                  suffix="%"
                  :label="t(`fileman.resizeImagePercent`)"
                  :rules="sizeFields.percentValidation"
                  hide-bottom-space
                  @update:model-value="sizeFields.setPercent" />
                <div class="text-caption text-grey mt-1">
                  {{ t('fileman.imageEditorResizeHint') }}
                </div>
              </div>
            </template>

            <!-- STRAIGHTEN -->
            <template v-else-if="state.panel === `straighten`">
              <div class="asset-editor-field">
                <div class="text-caption">{{ t('fileman.imageEditorAngle') }}</div>
                <w-slider
                  :model-value="state.straighten.angle"
                  :min="-45"
                  :max="45"
                  :step="0.1"
                  label
                  :label-value="`${state.straighten.angle}°`"
                  :aria-label="t(`fileman.imageEditorAngle`)"
                  @update:model-value="setStraightenAngle" />
              </div>
              <div class="asset-editor-field">
                <w-toggle
                  v-model="state.straighten.cropToFit"
                  :label="t(`fileman.imageEditorCropToFit`)" />
              </div>
              <div v-if="!state.straighten.cropToFit" class="asset-editor-field">
                <div class="text-caption mb-1">{{ t('fileman.imageEditorFill') }}</div>
                <image-fill-picker
                  v-model="state.straighten.background"
                  :label="t(`fileman.imageEditorFill`)" />
              </div>
            </template>

            <!-- PAD -->
            <template v-else-if="state.panel === `pad`">
              <div class="asset-editor-field">
                <w-toggle
                  :model-value="state.pad.linked"
                  :label="t(`fileman.imageEditorPadLinked`)"
                  @update:model-value="setPadLinked" />
              </div>
              <div class="asset-editor-field asset-editor-pad">
                <w-input
                  v-for="side of PAD_SIDES"
                  :key="side"
                  :model-value="String(state.pad[side])"
                  :class="`is-${side}`"
                  type="number"
                  outlined
                  dense
                  suffix="px"
                  :label="t(PAD_LABELS[side])"
                  :disable="state.pad.linked && side !== `top`"
                  @update:model-value="setPad(side, $event)" />
              </div>
              <div class="asset-editor-field">
                <div class="text-caption mb-1">{{ t('fileman.imageEditorFill') }}</div>
                <image-fill-picker
                  v-model="state.pad.background"
                  :label="t(`fileman.imageEditorFill`)" />
              </div>
            </template>

            <!-- REDACT -->
            <template v-else-if="state.panel === `redact`">
              <div class="asset-editor-field">
                <div class="text-caption mb-1">{{ t('fileman.imageEditorRedactStyle') }}</div>
                <!-- -> `dark-2`: two steps lighter than the sidebar, like every toggle on it -->
                <w-btn-toggle
                  v-model="state.redact.style"
                  push
                  no-caps
                  color="dark-2"
                  toggle-color="primary"
                  :aria-label="t(`fileman.imageEditorRedactStyle`)"
                  :options="redactStyleOptions" />
                <div
                  class="text-caption mt-2"
                  :class="state.redact.style === `fill` ? `text-grey` : `text-warning`">
                  {{
                    state.redact.style === `fill`
                      ? t('fileman.imageEditorRedactFillHint')
                      : t('fileman.imageEditorRedactReversibleHint')
                  }}
                </div>
              </div>
              <div v-if="state.redact.style === `fill`" class="asset-editor-field">
                <div class="text-caption mb-1">{{ t('fileman.imageEditorFill') }}</div>
                <image-fill-picker
                  v-model="state.redact.color"
                  :allow-transparent="false"
                  :label="t(`fileman.imageEditorFill`)" />
              </div>
              <div v-else class="asset-editor-field">
                <div class="text-caption">
                  {{
                    state.redact.style === `pixelate`
                      ? t('fileman.imageEditorRedactBlockSize')
                      : t('fileman.imageEditorRedactStrength')
                  }}
                </div>
                <w-slider
                  v-if="state.redact.style === `pixelate`"
                  v-model="state.redact.blockSize"
                  :min="8"
                  :max="64"
                  :step="4"
                  label
                  :aria-label="t(`fileman.imageEditorRedactBlockSize`)" />
                <w-slider
                  v-else
                  v-model="state.redact.strength"
                  :min="5"
                  :max="50"
                  :step="5"
                  label
                  :aria-label="t(`fileman.imageEditorRedactStrength`)" />
              </div>
              <div class="asset-editor-field text-caption text-grey">
                {{ t('fileman.imageEditorRedactAgainHint') }}
              </div>
            </template>

            <!-- ADJUST -->
            <template v-else-if="state.panel === `adjust`">
              <div v-for="slider of ADJUST_SLIDERS" :key="slider" class="asset-editor-field">
                <div class="text-caption">{{ t(ADJUST_LABELS[slider]) }}</div>
                <w-slider
                  :model-value="Math.round(state.adjust[slider] * 100)"
                  :min="0"
                  :max="200"
                  :step="5"
                  label
                  :label-value="`${Math.round(state.adjust[slider] * 100)}%`"
                  :aria-label="t(ADJUST_LABELS[slider])"
                  @update:model-value="state.adjust[slider] = $event / 100" />
              </div>
              <div class="asset-editor-field">
                <w-toggle
                  v-model="state.adjust.grayscale"
                  :label="t(`fileman.imageEditorGrayscale`)" />
              </div>
              <div class="asset-editor-field">
                <w-toggle v-model="state.adjust.sharpen" :label="t(`fileman.imageEditorSharpen`)" />
                <div class="text-caption text-grey mt-2">
                  {{ t('fileman.imageEditorSharpenHint') }}
                </div>
              </div>
            </template>

            <div class="asset-editor-panel-actions">
              <w-btn
                class="acrylic-btn"
                flat
                no-caps
                color="cancel"
                padding="xs md"
                :label="
                  state.panel === `redact` ? t(`common.actions.close`) : t(`common.actions.cancel`)
                "
                @click="closePanel" />
              <w-btn
                unelevated
                no-caps
                color="primary"
                padding="xs md"
                :label="t(`common.actions.apply`)"
                :disable="!canApply"
                @click="applyPanel" />
            </div>
          </div>
        </aside>
      </div>
      <w-inner-loading :showing="state.isSaving" size="38px" spinner-class="text-accent" />
    </div>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { isEqual } from 'es-toolkit/predicate'
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch
} from 'vue'

import { confirm, dialog, dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { useImageSizeFields } from '@/composables/imageSizeFields'
import { notify } from '@/composables/notify'
import { useScreen } from '@/composables/screen'
import { apiErrorMessage } from '@/helpers/apiError'
import {
  adjustFilter,
  centredRegion,
  decodeForPreview,
  drawOperation,
  drawOperations,
  findTrim,
  inscribedCrop,
  isNeutralAdjust,
  NEUTRAL_ADJUST,
  pushOperation,
  SHARPEN_FILTER_ID,
  sizeAfter,
  sizeAfterAll,
  TRANSPARENT
} from '@/helpers/imageEdit'
import { useSiteStore } from '@/stores/site'

import ImageFillPicker from './ImageFillPicker.vue'
import ImageRegionBox from './ImageRegionBox.vue'

/**
 * The image editor: rotate, mirror, crop, redact and the rest, over a PNG, JPEG, WebP or GIF in the
 * file manager. See dev/specs/image-editor.md.
 *
 * Nothing drawn here is uploaded. The editor keeps a list of edits and draws what they would produce;
 * saving sends the list, and the server replays it on the original with Sharp. So every position in
 * the list is in the original's pixels, whatever size the preview is drawn at.
 *
 * Opened over the file manager rather than instead of it, which is why it is a dialog and not one of
 * the main overlays: the file manager IS the main overlay. Says OK with the asset written.
 */

// PROPS

const props = defineProps({
  assetId: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const siteStore = useSiteStore()

// -> Below 600px the header has no room for the two buttons' labels, and keeps their icons
const screen = useScreen()

// I18N

const { t } = useI18n()

// DATA

/** The most undo steps kept. The oldest goes first. */
const HISTORY_LIMIT = 100

const PAD_SIDES = ['top', 'right', 'bottom', 'left']

const PAD_LABELS = {
  top: 'fileman.imageEditorPadTop',
  right: 'fileman.imageEditorPadRight',
  bottom: 'fileman.imageEditorPadBottom',
  left: 'fileman.imageEditorPadLeft'
}

const ADJUST_SLIDERS = ['brightness', 'contrast', 'saturation']

const ADJUST_LABELS = {
  brightness: 'fileman.imageEditorBrightness',
  contrast: 'fileman.imageEditorContrast',
  saturation: 'fileman.imageEditorSaturation'
}

const ASPECTS = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '3:4': 3 / 4,
  '2:3': 2 / 3,
  '9:16': 9 / 16
}

const state = reactive({
  status: 'loading',
  /** What `GET …/editing` answered: may the session replace, may it save a copy, how many frames. */
  info: null,
  originalWidth: 0,
  originalHeight: 0,
  /** Snapshots of `{ operations, adjust }`, the first being the original. */
  history: [],
  historyIndex: 0,
  isSaving: false,
  /** A dialog of the editor's own is open over it, and has the keyboard. */
  isBlocked: false,
  stageWidth: 0,
  stageHeight: 0,
  /** The open panel, or null for the list of actions. */
  panel: null,
  /** Crop, Trim and Redact's region, in the image's pixels. */
  region: null,
  aspect: 'free',
  trimTolerance: 10,
  straighten: { angle: 0, cropToFit: true, background: TRANSPARENT },
  pad: { linked: true, top: 0, right: 0, bottom: 0, left: 0, background: TRANSPARENT },
  redact: { style: 'fill', color: '#000000', blockSize: 16, strength: 20 },
  /** Adjust's settings while its panel is open. */
  adjust: { ...NEUTRAL_ADJUST }
})

/** The decoded original, and the preview of every operation committed so far. Never reactive. */
let source = null
let committed = null
let frameRequest = 0
let stageObserver = null

// REFS

const stage = ref(null)
const canvas = ref(null)

// COMPUTED

const current = computed(
  () => state.history[state.historyIndex] ?? { operations: [], adjust: NEUTRAL_ADJUST }
)

const original = computed(() => ({ width: state.originalWidth, height: state.originalHeight }))

/** The image's size after every committed operation. */
const size = computed(() => sizeAfterAll(original.value, current.value.operations))

const isReady = computed(() => state.status === 'ready' && !state.isSaving)
const isBusy = computed(() => !isReady.value || state.panel !== null)

const hasChanges = computed(
  () => current.value.operations.length > 0 || !isNeutralAdjust(current.value.adjust)
)
const canUndo = computed(() => state.historyIndex > 0)
const canRedo = computed(() => state.historyIndex < state.history.length - 1)

const sizeFields = useImageSizeFields(() => size.value)

const aspectRatio = computed(() =>
  state.aspect === 'original' ? size.value.width / size.value.height : ASPECTS[state.aspect]
)

const hasRegion = computed(() => ['crop', 'trim', 'redact'].includes(state.panel))

/**
 * What the open panel would add, previewed as it is set up and committed by Apply. Crop and Trim add
 * nothing until then: the region box is their preview.
 */
const pendingOperations = computed(() => {
  switch (state.panel) {
    case 'straighten': {
      const { angle, cropToFit, background } = state.straighten
      if (angle === 0) {
        return []
      }
      const rotate = { op: 'rotate', angle, background: cropToFit ? TRANSPARENT : background }
      return cropToFit
        ? [rotate, { op: 'crop', ...inscribedCrop(size.value.width, size.value.height, angle) }]
        : [rotate]
    }
    case 'resize': {
      const width = Number(sizeFields.fields.width)
      const height = Number(sizeFields.fields.height)
      return sizeFields.isValid.value &&
        (width !== size.value.width || height !== size.value.height)
        ? [{ op: 'resize', width, height }]
        : []
    }
    case 'pad': {
      const { top, right, bottom, left, background } = state.pad
      return top + right + bottom + left > 0
        ? [{ op: 'extend', top, right, bottom, left, background }]
        : []
    }
    case 'redact':
      return state.region ? [redaction()] : []
    default:
      return []
  }
})

/** The size the stage shows, which the pending operations may change. */
const shownSize = computed(() => sizeAfterAll(size.value, pendingOperations.value))

/** The preview's size on screen: fitted to the stage when larger, never enlarged when smaller. */
const display = computed(() => {
  const { width, height } = shownSize.value
  if (!width || !height || !state.stageWidth) {
    return { width: 0, height: 0 }
  }
  const fit = Math.min(1, state.stageWidth / width, state.stageHeight / height)
  return {
    width: Math.max(1, Math.floor(width * fit)),
    height: Math.max(1, Math.floor(height * fit))
  }
})

const previewFilter = computed(() =>
  adjustFilter(state.panel === 'adjust' ? state.adjust : current.value.adjust)
)

const caption = computed(() => {
  if (state.status !== 'ready') {
    return ''
  }
  const dims = `${shownSize.value.width} × ${shownSize.value.height}`
  return state.info?.frames > 1
    ? `${dims} · ${t('fileman.imageEditorFrames', { count: state.info.frames })}`
    : dims
})

const actions = computed(() => [
  {
    key: 'rotateRight',
    icon: 'la:redo-alt',
    label: t('fileman.imageEditorRotateRight'),
    shortcut: 'R',
    run: () => addOperation({ op: 'rotate', angle: 90 })
  },
  {
    key: 'rotateLeft',
    icon: 'la:undo-alt',
    label: t('fileman.imageEditorRotateLeft'),
    shortcut: '⇧R',
    run: () => addOperation({ op: 'rotate', angle: -90 })
  },
  {
    key: 'mirror',
    icon: 'la:arrows-alt-h',
    label: t('fileman.imageEditorMirror'),
    shortcut: 'H',
    run: () => addOperation({ op: 'flop' })
  },
  {
    key: 'flip',
    icon: 'la:arrows-alt-v',
    label: t('fileman.imageEditorFlip'),
    shortcut: 'V',
    run: () => addOperation({ op: 'flip' })
  },
  {
    key: 'straighten',
    icon: 'la:ruler-combined',
    label: t('fileman.imageEditorStraighten'),
    run: () => openPanel('straighten')
  },
  {
    key: 'crop',
    icon: 'la:crop',
    label: t('fileman.imageEditorCrop'),
    shortcut: 'C',
    run: () => openPanel('crop')
  },
  {
    key: 'trim',
    icon: 'la:cut',
    label: t('fileman.imageEditorTrim'),
    run: () => openPanel('trim')
  },
  {
    key: 'resize',
    icon: 'la:compress-arrows-alt',
    label: t('fileman.imageEditorResize'),
    run: () => openPanel('resize')
  },
  {
    key: 'pad',
    icon: 'la:border-style',
    label: t('fileman.imageEditorPad'),
    run: () => openPanel('pad')
  },
  {
    key: 'redact',
    icon: 'la:eye-slash',
    label: t('fileman.imageEditorRedact'),
    run: () => openPanel('redact')
  },
  {
    key: 'adjust',
    icon: 'la:sliders-h',
    label: t('fileman.imageEditorAdjust'),
    run: () => openPanel('adjust')
  }
])

/** The action whose panel is open, for its heading. */
const panelAction = computed(
  () => actions.value.find((action) => action.key === state.panel) ?? { icon: '', label: '' }
)

const aspectOptions = computed(() => [
  { label: t('fileman.imageEditorAspectFree'), value: 'free' },
  { label: t('fileman.imageEditorAspectOriginal'), value: 'original' },
  ...Object.keys(ASPECTS)
    .filter((key) => key !== 'free')
    .map((key) => ({ label: key, value: key }))
])

const redactStyleOptions = computed(() => [
  { label: t('fileman.imageEditorRedactFill'), value: 'fill' },
  { label: t('fileman.imageEditorRedactPixelate'), value: 'pixelate' },
  { label: t('fileman.imageEditorRedactBlur'), value: 'blur' }
])

/** Whether Apply would change anything, which is the only time it is offered. */
const canApply = computed(() => {
  switch (state.panel) {
    case 'crop':
    case 'trim':
      return Boolean(state.region) && !isWholeImage(state.region)
    case 'redact':
      return Boolean(state.region)
    case 'adjust':
      return !isEqual(state.adjust, current.value.adjust)
    default:
      return pendingOperations.value.length > 0
  }
})

// WATCHERS

watch(() => current.value.operations, renderCommitted)

// -> Deep, since a region being dragged or a slider moved is a change inside the same list
watch(pendingOperations, scheduleRedraw, { deep: true })

// METHODS

function isWholeImage(region) {
  return (
    region.left === 0 &&
    region.top === 0 &&
    region.width === size.value.width &&
    region.height === size.value.height
  )
}

function redaction() {
  const { style, color, blockSize, strength } = state.redact
  return {
    op: 'redact',
    ...state.region,
    style,
    ...(style === 'fill' ? { color } : { size: style === 'pixelate' ? blockSize : strength })
  }
}

/** Load the original and what the session may do with it, and start again from it. */
async function load() {
  state.status = 'loading'
  try {
    const info = await API_CLIENT.get(
      `sites/${siteStore.id}/assets/${props.assetId}/editing`
    ).json()
    if (!info.imageEditing) {
      throw new Error(t('fileman.imageEditorSharpMissing'))
    }
    if (!info.mayReplace && !info.maySaveAs) {
      throw new Error(t('fileman.imageEditorDenied'))
    }
    const blob = await API_CLIENT.get(
      `sites/${siteStore.id}/assets/${props.assetId}/content`
    ).blob()
    source?.image.close()
    source = await decodeForPreview(blob)
    state.info = info
    state.originalWidth = source.width
    state.originalHeight = source.height
    state.history = [{ operations: [], adjust: { ...NEUTRAL_ADJUST } }]
    state.historyIndex = 0
    state.panel = null
    renderCommitted()
    state.status = 'ready'
  } catch (err) {
    notify({
      type: 'negative',
      message: t('fileman.imageEditorLoadFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
    onDialogCancel()
  }
}

/** Redraw the committed operations from the original, which is the one thing undo can rely on. */
function renderCommitted() {
  if (!source) {
    return
  }
  committed = drawOperations(source.image, current.value.operations, original.value)
  scheduleRedraw()
}

/** Draw the preview on the next frame, so that a drag or a slider redraws once per frame at most. */
function scheduleRedraw() {
  if (!frameRequest) {
    frameRequest = requestAnimationFrame(redraw)
  }
}

function redraw() {
  frameRequest = 0
  if (!committed || !canvas.value) {
    return
  }
  const scale = committed.width / size.value.width
  let preview = committed
  let at = size.value
  for (const op of pendingOperations.value) {
    preview = drawOperation(preview, op, at, scale)
    at = sizeAfter(at, op)
  }
  canvas.value.width = preview.width
  canvas.value.height = preview.height
  canvas.value.getContext('2d').drawImage(preview, 0, 0)
}

/** Make a snapshot the current state, dropping anything that had been undone. */
function commit(snapshot) {
  state.history = [...state.history.slice(0, state.historyIndex + 1), snapshot].slice(
    -(HISTORY_LIMIT + 1)
  )
  state.historyIndex = state.history.length - 1
}

function addOperation(op) {
  if (!isReady.value || state.panel) {
    return
  }
  commit({ operations: pushOperation(current.value.operations, op), adjust: current.value.adjust })
}

function undo() {
  if (canUndo.value && !isBusy.value) {
    state.historyIndex--
  }
}

function redo() {
  if (canRedo.value && !isBusy.value) {
    state.historyIndex++
  }
}

/** Back to the original -- as a step of its own, so that it can be undone too. */
function reset() {
  if (hasChanges.value && !isBusy.value) {
    commit({ operations: [], adjust: { ...NEUTRAL_ADJUST } })
  }
}

function openPanel(panel) {
  if (!isReady.value || state.panel) {
    return
  }
  switch (panel) {
    case 'crop':
      state.aspect = 'free'
      state.region = centredRegion(size.value, null)
      break
    case 'trim':
      state.region = null
      break
    case 'redact':
      state.region = newRedactRegion()
      break
    case 'resize':
      sizeFields.reset()
      break
    case 'straighten':
      state.straighten.angle = 0
      state.straighten.cropToFit = true
      break
    case 'pad':
      Object.assign(state.pad, { top: 0, right: 0, bottom: 0, left: 0 })
      break
    case 'adjust':
      state.adjust = { ...current.value.adjust }
      break
  }
  state.panel = panel
  if (panel === 'trim') {
    setTrimTolerance(state.trimTolerance)
  }
}

function closePanel() {
  state.panel = null
  state.region = null
  scheduleRedraw()
}

function applyPanel() {
  if (!canApply.value) {
    return
  }
  const panel = state.panel
  if (panel === 'adjust') {
    commit({ operations: current.value.operations, adjust: { ...state.adjust } })
    closePanel()
    return
  }
  const operations =
    panel === 'crop' || panel === 'trim'
      ? [{ op: 'crop', ...state.region }]
      : pendingOperations.value.map((op) => ({ ...op }))
  commit({
    operations: operations.reduce(pushOperation, current.value.operations),
    adjust: current.value.adjust
  })
  // -> Redact stays open for the next region, which starts afresh so the one just added shows
  if (panel === 'redact') {
    state.region = newRedactRegion(operations[0])
  } else {
    closePanel()
  }
}

/**
 * Where Redact's box starts: a third of the image each way, in the middle of it.
 *
 * After an Apply, the box would otherwise stay on the block it just added, and nothing on screen would
 * change -- so it goes back to the middle, and if that IS where the block went, a little down and to
 * the right of it, so that the new box reads as a second one rather than the same one again.
 *
 * @param {object} [applied] The redaction just added, if any
 */
function newRedactRegion(applied) {
  const { width, height } = size.value
  const region = {
    left: Math.floor(width / 3),
    top: Math.floor(height / 3),
    width: Math.max(1, Math.floor(width / 3)),
    height: Math.max(1, Math.floor(height / 3))
  }
  if (applied && applied.left === region.left && applied.top === region.top) {
    const step = Math.max(8, Math.round(Math.min(width, height) / 20))
    region.left = Math.min(width - region.width, region.left + step)
    region.top = Math.min(height - region.height, region.top + step)
  }
  return region
}

function setAspect(aspect) {
  state.aspect = aspect
  state.region = centredRegion(size.value, aspectRatio.value)
}

/** A size typed into Crop's fields: kept inside the image, and to the ratio when one is chosen. */
function setRegionSize(axis, val) {
  const n = Number.parseInt(val, 10)
  if (!state.region || !(n > 0)) {
    return
  }
  const { width: W, height: H } = size.value
  const aspect = aspectRatio.value
  let { width, height } = state.region
  if (axis === 'width') {
    width = Math.min(n, W)
    if (aspect) {
      height = Math.round(width / aspect)
    }
  } else {
    height = Math.min(n, H)
    if (aspect) {
      width = Math.round(height * aspect)
    }
  }
  if (aspect && (width > W || height > H)) {
    const fit = Math.min(W / width, H / height)
    width = Math.round(width * fit)
    height = Math.round(height * fit)
  }
  width = Math.max(1, Math.min(W, width))
  height = Math.max(1, Math.min(H, height))
  state.region = {
    left: Math.min(state.region.left, W - width),
    top: Math.min(state.region.top, H - height),
    width,
    height
  }
}

/** Trim's tolerance is a percentage of the full range a channel can differ by. */
function setTrimTolerance(val) {
  state.trimTolerance = val
  state.region = committed ? findTrim(committed, size.value, Math.round((val / 100) * 255)) : null
}

/**
 * Held to tenths of a degree, which is what the slider steps by: a step of 0.1 added up in floating
 * point drifts (`8.000000000000352`), and the drift would be both shown and sent.
 */
function setStraightenAngle(val) {
  state.straighten.angle = Math.round(val * 10) / 10
}

function setPadLinked(linked) {
  state.pad.linked = linked
  if (linked) {
    setPad('top', state.pad.top)
  }
}

function setPad(side, val) {
  const n = Math.max(0, Math.min(4096, Number.parseInt(val, 10) || 0))
  if (state.pad.linked) {
    Object.assign(state.pad, { top: n, right: n, bottom: n, left: n })
  } else {
    state.pad[side] = n
  }
}

/** Open one of the editor's own dialogs, which takes the keyboard until it closes. */
function openOwnDialog(handle) {
  state.isBlocked = true
  return handle.onDismiss(() => {
    state.isBlocked = false
  })
}

function discard() {
  if (state.isSaving) {
    return
  }
  if (!hasChanges.value) {
    onDialogCancel()
    return
  }
  openOwnDialog(
    confirm({
      title: t('fileman.imageEditorDiscardTitle'),
      message: t('fileman.imageEditorDiscardConfirm'),
      cancel: true,
      color: 'negative',
      okLabel: t('common.actions.discard')
    })
  ).onOk(onDialogCancel)
}

function save(mode) {
  if (!hasChanges.value || isBusy.value) {
    return
  }
  openOwnDialog(
    dialog({
      component: defineAsyncComponent(() => import('@/components/AssetEditorSaveDialog.vue')),
      componentProps: {
        mode,
        fileName: props.fileName,
        frames: state.info?.frames ?? 1
      }
    })
  ).onOk(({ fileName, quality }) => submit(mode, fileName, quality))
}

async function submit(mode, fileName, quality) {
  state.isSaving = true
  try {
    const resp = await API_CLIENT.post(`sites/${siteStore.id}/assets/${props.assetId}/edit`, {
      json: {
        operations: current.value.operations,
        adjust: current.value.adjust,
        mode,
        ...(fileName ? { fileName } : {}),
        quality,
        unchangedSince: state.info.updatedAt
      }
    }).json()
    // -> The API client does not throw on 400, so a refused edit comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message:
        mode === 'saveAs'
          ? t('fileman.imageEditorSavedAs', { fileName: resp.asset.fileName })
          : t('fileman.imageEditorReplaced')
    })
    state.isSaving = false
    onDialogOK(resp.asset)
  } catch (err) {
    state.isSaving = false
    if (err?.data?.error === 'assetChanged') {
      openOwnDialog(
        confirm({
          title: t('fileman.imageEditorChangedTitle'),
          message: t('fileman.imageEditorChanged'),
          cancel: true,
          okLabel: t('fileman.imageEditorReload')
        })
      ).onOk(load)
      return
    }
    notify({
      type: 'negative',
      message: t('fileman.imageEditorSaveFailed'),
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
}

/**
 * The editor's shortcuts. None of them while a field has the focus -- it is typing -- nor while one
 * of the editor's own dialogs is over it; and only Escape and Enter while a panel is open, the rest
 * being actions the panel has set aside.
 */
function onKeydown(ev) {
  if (!dialogVisible.value || state.isBlocked || state.isSaving) {
    return
  }
  const target = ev.target
  if (target.closest?.('input, textarea, select, [contenteditable="true"]')) {
    return
  }
  const key = ev.key.toLowerCase()
  if (ev.ctrlKey || ev.metaKey) {
    if (key === 'z' || key === 'y') {
      ev.preventDefault()
      if (key === 'y' || ev.shiftKey) {
        redo()
      } else {
        undo()
      }
    }
    return
  }
  if (ev.altKey) {
    return
  }
  if (key === 'escape') {
    ev.preventDefault()
    if (state.panel) {
      closePanel()
    } else {
      discard()
    }
    return
  }
  if (state.panel) {
    // -> Not on a button, where Enter is already that button's press
    if (key === 'enter' && target.tagName !== 'BUTTON') {
      ev.preventDefault()
      applyPanel()
    }
    return
  }
  const shortcut = {
    r: () => addOperation({ op: 'rotate', angle: ev.shiftKey ? -90 : 90 }),
    h: () => addOperation({ op: 'flop' }),
    v: () => addOperation({ op: 'flip' }),
    c: () => openPanel('crop')
  }[key]
  if (shortcut) {
    ev.preventDefault()
    shortcut()
  }
}

// MOUNTED

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // -> The stage's free space, less its padding, is what the preview is fitted to
  stageObserver = new ResizeObserver(([entry]) => {
    state.stageWidth = entry.contentRect.width
    state.stageHeight = entry.contentRect.height
  })
  // -> Watched rather than observed here: `WDialog` renders its panel only once open, a tick from now
  watch(
    stage,
    (el) => {
      stageObserver.disconnect()
      if (el) {
        stageObserver.observe(el)
      }
    },
    { immediate: true }
  )
  load()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stageObserver?.disconnect()
  cancelAnimationFrame(frameRequest)
  source?.image.close()
  source = null
  committed = null
})
</script>

<style scoped lang="scss">
.asset-editor {
  &-frame {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    background-color: $dark-6;
  }

  &-bar {
    flex: 0 0 auto;
    gap: 4px;
  }

  &-body {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;

    // -> The sidebar goes under the image on a narrow screen, as a toolbar and the panel above it
    @media (max-width: 1023px) {
      flex-direction: column;
    }
  }

  &-stage {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
    padding: 16px;
    overflow: hidden;
  }

  /*
    Exactly the size the preview is shown at, so that the region box laid over it can place itself in
    percentages. The checkerboard is what makes transparency visible, which Pad and Straighten can
    both produce.
  */
  &-canvas {
    position: relative;
    flex: none;
    background-color: #fff;
    background-image: conic-gradient(#ccc 25%, transparent 0 50%, #ccc 0 75%, transparent 0);
    background-size: 16px 16px;

    canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  }

  &-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.35) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.35) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  &-sidebar {
    flex: 0 0 300px;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
    // -> A step above the stage's near-black, so the two read as separate panes
    background-color: $dark-4;
    color: #fff;

    @media (max-width: 1023px) {
      flex: 0 0 auto;
      max-height: 45%;
    }
  }

  &-actions {
    display: flex;
    flex-direction: column;

    /*
      A faint rule between rows, inset by their padding. Drawn as `WList`'s separator is -- a pseudo
      scaled to one device pixel, rather than a 1px border that lands on fractional rows under display
      scaling -- and fainter than its 0.15, since it divides rows of one list rather than sections.
      Gone beside a highlighted row, where it would cut across the highlight's rounded edge.
    */
    > .asset-editor-action + .asset-editor-action::before {
      content: '';
      position: absolute;
      top: 0;
      left: 10px;
      right: 10px;
      height: 1px;
      background-color: rgb(255 255 255 / 0.08);
      transform: scaleY(calc(1 / var(--w-dpr, 1)));
      transform-origin: top left;
      pointer-events: none;
    }

    > .asset-editor-action:is(:hover:not(:disabled), :focus-visible)::before,
    > .asset-editor-action:is(:hover:not(:disabled), :focus-visible)
      + .asset-editor-action::before {
      opacity: 0;
    }

    // -> A row of icons across the bottom on a narrow screen, where rules between rows do not apply
    @media (max-width: 1023px) {
      flex-direction: row;
      overflow-x: auto;

      > .asset-editor-action + .asset-editor-action::before {
        content: none;
      }
    }
  }

  &-action {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 6px;
    text-align: left;
    font-size: 0.875rem;
    cursor: pointer;

    &:hover:not(:disabled),
    &:focus-visible {
      background-color: rgba(128, 128, 128, 0.15);
      outline: none;
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }

    &-label {
      flex: 1 1 auto;
    }

    kbd {
      padding: 0 6px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      border-radius: 4px;
      font-family: inherit;
      font-size: 0.75rem;
      opacity: 0.7;
    }

    // -> In the narrow toolbar, each is an icon over a word, and the shortcuts are left to the tooltip
    @media (max-width: 1023px) {
      flex: 0 0 auto;
      flex-direction: column;
      gap: 4px;
      width: auto;
      min-width: 72px;
      text-align: center;
      font-size: 0.75rem;

      kbd {
        display: none;
      }
    }
  }

  // -> Undo, Redo and Reset: one row of three equal buttons, pushed to the foot of the sidebar
  &-animated {
    flex: none;
    // -> The icon's own warning colour, see-through: twice the `.card-notice` tint, which is pitched for
    //    a light card and would all but vanish on this dark one
    background-color: color-mix(in srgb, var(--color-warning) 20%, transparent);
  }

  &-history {
    display: flex;
    gap: 4px;
    margin-top: auto;
    padding-top: 12px;

    > .asset-editor-action {
      flex: 1 1 0;
      justify-content: center;
      gap: 8px;
      min-width: 0;
      padding-inline: 6px;
    }

    // -> Three to a 276px row, so a longer translation shortens rather than spilling out
    .asset-editor-action-label {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    // -> Still one row under the narrow toolbar, rather than taking on its icon-over-word shape
    @media (max-width: 1023px) {
      margin-top: 8px;

      > .asset-editor-action {
        flex-direction: row;
        font-size: 0.875rem;
      }
    }
  }

  &-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;

    // -> Out over the sidebar's 12px padding on three sides, so the band meets its edges
    &-title {
      margin: -12px -12px 0;
    }

    &-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  }

  // -> The four sides laid out where they are: top over left and right, bottom under them
  &-pad {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;

    .is-top,
    .is-bottom {
      grid-column: 1 / span 2;
      justify-self: center;
      width: 50%;
    }
    .is-top {
      grid-row: 1;
    }
    .is-left {
      grid-row: 2;
      grid-column: 1;
    }
    .is-right {
      grid-row: 2;
      grid-column: 2;
    }
    .is-bottom {
      grid-row: 3;
    }
  }
}
</style>
