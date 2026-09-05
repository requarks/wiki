<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="folder-color relative" style="width: 420px; max-width: 90vw">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-color-wheel.svg" size="sm" class="mr-2" />
        <div class="min-w-0">
          <div>{{ t('fileman.folderColor') }}</div>
          <div class="text-caption truncate">{{ folderTitle }}</div>
        </div>
      </w-card-section>
      <!--
        The swatch is the folder icon itself under the filter it is offering, rather than a plain
        square of colour: the filter is an approximation over RGB and what it makes of the icon is not
        quite the colour the angle names, so a square would be promising something slightly different
        from what the tree will show.
      -->
      <div class="folder-color-grid p-4">
        <button
          v-for="color of FOLDER_COLORS"
          :key="color.hue"
          class="folder-color-swatch w-unstyled"
          :class="color.hue === state.hue && `is-selected`"
          :aria-label="color.name"
          :aria-pressed="color.hue === state.hue"
          @click="state.hue = color.hue">
          <w-icon
            name="img:/_assets/icons/fluent-folder.svg"
            size="lg"
            :style="folderIconStyle(color.hue)" />
          <w-tooltip>{{ color.name }}</w-tooltip>
        </button>
      </div>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="grey"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.apply`)"
          color="primary"
          padding="xs md"
          :loading="state.loading > 0"
          @click="save" />
      </w-card-actions>
      <w-inner-loading :showing="state.loading > 0" size="38px" spinner-class="text-accent" />
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { reactive } from 'vue'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'

import { FOLDER_COLORS, folderIconStyle } from '@/helpers/folderColors'
import { apiErrorMessage } from '@/helpers/apiError'
import { useSiteStore } from '@/stores/site'

/**
 * Pick the colour of a folder's icon.
 *
 * What is chosen is a hue rotation applied to the one folder icon the app draws everywhere, not a
 * colour of its own — see `helpers/folderColors`. The first swatch is a rotation of nothing, which is
 * both the colour every folder starts out and the way to put a coloured one back.
 */

// PROPS

const props = defineProps({
  folderId: {
    type: String,
    required: true
  },
  folderTitle: {
    type: String,
    default: ''
  },
  /** The folder's current colour, so the dialog opens on it. */
  hue: {
    type: Number,
    default: 0
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  hue: props.hue,
  loading: 0
})

// METHODS

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put(
      `sites/${siteStore.id}/tree/folders/${props.folderId}/color`,
      {
        json: { hue: state.hue }
      }
    ).json()
    // -> The API client does not throw on 400, so a refused value comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    onDialogOK(state.hue)
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to set the folder color.',
      caption: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  state.loading--
}
</script>

<style scoped lang="scss">
.folder-color {
  &-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }

  &-swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 0;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s var(--ease-standard);

    &:hover {
      @at-root .body--light & {
        background-color: $blue-grey-1;
      }
      @at-root .body--dark & {
        background-color: $dark-4;
      }
    }

    // -> The border rather than a background: the swatch IS a colour, and tinting the box behind it
    //    would be one more colour arguing with it
    &.is-selected,
    &:focus-visible {
      border-color: var(--color-primary);
    }
  }
}
</style>
