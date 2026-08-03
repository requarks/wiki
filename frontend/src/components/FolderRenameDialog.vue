<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="relative" style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-rename.svg" size="sm" class="mr-2" />
        <span>{{ t(`fileman.folderRename`) }}</span>
      </w-card-section>
      <w-form ref="renameFolderForm" class="py-2" @submit="rename">
        <w-item>
          <blueprint-icon icon="folder" />
          <w-item-section>
            <w-input
              ref="iptTitle"
              v-model="state.title"
              outlined
              dense
              :rules="titleValidation"
              hide-bottom-space
              :label="t(`fileman.folderTitle`)"
              lazy-rules="ondemand"
              @keyup:enter="rename" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="file-submodule" class="self-start" />
          <w-item-section>
            <w-input
              v-model="state.path"
              outlined
              dense
              :rules="pathValidation"
              hide-bottom-space
              :label="t(`fileman.folderFileName`)"
              :hint="t(`fileman.folderFileNameHint`)"
              lazy-rules="ondemand"
              @focus="state.pathDirty = true"
              @keyup:enter="rename" />
          </w-item-section>
        </w-item>
      </w-form>
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
          :label="t(`common.actions.rename`)"
          color="primary"
          padding="xs md"
          :loading="state.loading > 0"
          @click="rename" />
      </w-card-actions>
      <w-inner-loading :showing="state.loading > 0" size="38px" spinner-class="text-accent" />
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { onMounted, reactive, ref, watch } from 'vue'
import slugify from 'slugify'

import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  folderId: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptTitle.value
})

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  path: '',
  title: '',
  pathDirty: false,
  loading: false
})

// REFS

const renameFolderForm = ref(null)
const iptTitle = ref(null)

// VALIDATION RULES

const titleValidation = [
  (val) => val.length > 0 || t('fileman.folderTitleMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('fileman.folderTitleInvalidChars')
]

const pathValidation = [
  (val) => val.length > 0 || t('fileman.folderFileNameMissing'),
  (val) => /^[a-z0-9-]+$/.test(val) || t('fileman.folderFileNameInvalid')
]

// WATCHERS

watch(
  () => state.title,
  (newValue) => {
    if (state.pathDirty && !state.path) {
      state.pathDirty = false
    }
    if (!state.pathDirty) {
      state.path = slugify(newValue, { lower: true, strict: true })
    }
  }
)

// METHODS

async function rename() {
  state.loading++
  try {
    const isFormValid = await renameFolderForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('fileman.renameFolderInvalidData'))
    }
    const resp = await API_CLIENT.patch(`sites/${siteStore.id}/tree/folders/${props.folderId}`, {
      json: {
        pathName: state.path,
        title: state.title
      }
    }).json()
    // -> The API client does not throw on 400, so a refused name comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('fileman.renameFolderSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a name already taken alongside this folder answers 409
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.loading--
}

// MOUNTED

onMounted(async () => {
  state.loading++
  try {
    const folder = await API_CLIENT.get(
      `sites/${siteStore.id}/tree/folders/${props.folderId}`
    ).json()
    if (folder?.id !== props.folderId) {
      throw new Error('Failed to fetch folder data.')
    }
    state.path = folder.fileName
    state.title = folder.title
    state.pathDirty = true
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
    onDialogCancel()
  }
  state.loading--
})
</script>
