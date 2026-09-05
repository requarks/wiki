<template>
  <w-dialog
    class="asset-preview"
    v-model="dialogVisible"
    full-width
    full-height
    @hide="onDialogHide">
    <div class="asset-preview-frame">
      <div class="card-header asset-preview-bar px-4 py-2">
        <w-icon name="la:image" left size="md" />
        <div class="min-w-0">
          <div class="truncate">{{ fileName }}</div>
          <div class="text-caption">{{ caption }}</div>
        </div>
        <w-space />
        <w-btn
          class="mr-4"
          v-if="state.canZoom"
          :icon="state.zoomed ? `la:search-minus` : `la:search-plus`"
          :aria-label="zoomLabel"
          color="teal-3"
          dense
          flat
          @click="toggleZoom">
          <w-tooltip anchor="bottom middle" self="top middle">{{ zoomLabel }}</w-tooltip>
        </w-btn>
        <w-btn
          icon="la:times"
          :aria-label="t(`common.actions.close`)"
          color="pink-2"
          dense
          flat
          @click="onDialogCancel">
          <w-tooltip anchor="bottom middle" self="top middle">{{
            t(`common.actions.close`)
          }}</w-tooltip>
        </w-btn>
      </div>
      <!--
        Clicking beside the image dismisses, the way a lightbox does -- `.self` so that only the empty
        space around it counts, since the image itself is the thing being looked at.
      -->
      <div
        class="asset-preview-stage"
        :class="[state.zoomed ? `is-zoomed` : `is-fitted`, state.canZoom && `can-zoom`]"
        @click.self="onDialogCancel">
        <w-spinner v-if="state.status === `loading`" size="32px" color="grey-5" />
        <div class="asset-preview-failed" v-else-if="state.status === `failed`">
          <w-icon name="la:exclamation-triangle" size="lg" class="mb-2" />
          <span>{{ t('fileman.previewFailed') }}</span>
        </div>
        <!--
          Kept mounted while it loads rather than rendered on arrival: `@load` is what moves the state
          on, and an `<img>` that is not in the document never fires it. `v-show` hides the half-drawn
          image without taking it out of the page.
        -->
        <img
          v-show="state.status === `loaded`"
          :src="src"
          :alt="fileName"
          @load="onLoad"
          @error="state.status = `failed`"
          @click="toggleZoom" />
      </div>
    </div>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, reactive } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { assetContentUrl } from '@/helpers/assets'
import { useSiteStore } from '@/stores/site'

/**
 * Full-view image viewer.
 *
 * Opened from the file manager, over it rather than instead of it: closing this comes back to the
 * folder that was being browsed, with the same file still selected.
 *
 * The image is fetched by ID rather than by path -- the same way the thumbnail beside it is. A path
 * addresses the primary locale's file of that name, which is a different file from the one being
 * looked at whenever the manager is browsing another locale.
 */

// PROPS

const props = defineProps({
  assetId: {
    type: String,
    required: true
  },
  /** What to call it in the title bar. */
  fileName: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogCancel } = useDialogComponent()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  status: 'loading',
  /** Whether the image is bigger than the space it is being shown in, so 1:1 shows more of it. */
  canZoom: false,
  zoomed: false,
  width: 0,
  height: 0
})

// COMPUTED

const src = computed(() => assetContentUrl(siteStore.id, props.assetId))

/** The image's own size, once it is known. Read off the loaded image rather than from the asset's
 *  stored metadata, which an image uploaded before the dimensions were recorded does not have. */
const caption = computed(() =>
  state.status === 'loaded' ? `${state.width} × ${state.height}` : ''
)

const zoomLabel = computed(() =>
  t(state.zoomed ? 'fileman.previewFitToScreen' : 'fileman.previewActualSize')
)

// METHODS

async function onLoad(ev) {
  const img = ev.target
  state.width = img.naturalWidth
  state.height = img.naturalHeight
  state.status = 'loaded'
  /*
    Whether the fit shrank it, asked of the image itself once it is on screen -- so it accounts for
    the stage's padding and for either axis being the one that ran out, neither of which comparing
    against the stage's own box would. It has to wait a tick: the image is hidden until the line
    above lands, and an element with `display: none` measures zero.

    Measured once. A window resized while the viewer is open can leave the button out of step with
    the fit, which is worth less than a listener on every resize -- the answer only changes at the
    moment the image stops fitting.
  */
  await nextTick()
  state.canZoom = img.naturalWidth > img.clientWidth || img.naturalHeight > img.clientHeight
}

function toggleZoom() {
  if (state.canZoom) {
    state.zoomed = !state.zoomed
  }
}
</script>

<style scoped lang="scss">
.asset-preview {
  &-frame {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    background-color: $dark-6;
  }

  &-bar {
    flex: 0 0 auto;
  }

  /*
    Two modes, and the difference is only what the image is allowed to be: fitted, it is bounded by
    the stage and centred in it; at actual size it takes its own dimensions and the stage scrolls,
    with `margin: auto` keeping it centred while it is still smaller than the frame in one axis.
  */
  &-stage {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 16px;

    &.is-fitted {
      overflow: hidden;

      img {
        max-width: 100%;
        max-height: 100%;
      }
    }

    /*
      Three declarations to undo three defaults, all of which exist to stop an image overflowing --
      which at actual size is the entire point. The base stylesheet caps every image at the width of
      its container, a flex item shrinks to fit before it is allowed to overflow, and a flex container
      that centres an oversized item puts the overflow past its own start edge where no scrollbar can
      reach it. `margin: auto` is the fix for the last: auto margins take the free space when there is
      any, and collapse to nothing when there is not, so the image is centred while it fits and
      scrolls from its top left corner once it does not.
    */
    &.is-zoomed {
      overflow: auto;

      img {
        flex: none;
        max-width: none;
        max-height: none;
        margin: auto;
      }
    }

    // -> Only where pressing the image actually does something; one already at its full size does not
    &.can-zoom.is-fitted img {
      cursor: zoom-in;
    }
    &.can-zoom.is-zoomed img {
      cursor: zoom-out;
    }
  }

  &-failed {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: $grey-5;
    font-size: 0.9rem;
  }
}
</style>
