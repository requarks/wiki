<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-rename.svg', left, size='sm')
      span {{t(`fileman.folderRename`)}}
    q-form.q-py-sm(ref='renameFolderForm', @submit='rename')
      q-item
        blueprint-icon(icon='folder')
        q-item-section
          q-input(
            outlined
            v-model='state.title'
            dense
            :rules='titleValidation'
            hide-bottom-space
            :label='t(`fileman.folderTitle`)'
            :aria-label='t(`fileman.folderTitle`)'
            lazy-rules='ondemand'
            autofocus
            ref='iptTitle'
            @keyup.enter='rename'
            )
      q-item
        blueprint-icon.self-start(icon='file-submodule')
        q-item-section
          q-input(
            outlined
            v-model='state.path'
            dense
            :rules='pathValidation'
            hide-bottom-space
            :label='t(`fileman.folderFileName`)'
            :aria-label='t(`fileman.folderFileName`)'
            :hint='t(`fileman.folderFileNameHint`)'
            lazy-rules='ondemand'
            @focus='state.pathDirty = true'
            @keyup.enter='rename'
            )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        unelevated
        :label='t(`common.actions.rename`)'
        color='primary'
        padding='xs md'
        @click='rename'
        :loading='state.loading > 0'
        )
    q-inner-loading(:showing='state.loading > 0')
      q-spinner(color='accent', size='lg')
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { onMounted, reactive, ref, watch } from 'vue'
import slugify from 'slugify'

import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  folderId: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

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
  val => val.length > 0 || t('fileman.folderTitleMissing'),
  val => /^[^<>"]+$/.test(val) || t('fileman.folderTitleInvalidChars')
]

const pathValidation = [
  val => val.length > 0 || t('fileman.folderFileNameMissing'),
  val => /^[a-z0-9-]+$/.test(val) || t('fileman.folderFileNameInvalid')
]

// WATCHERS

watch(() => state.title, (newValue) => {
  if (state.pathDirty && !state.path) {
    state.pathDirty = false
  }
  if (!state.pathDirty) {
    state.path = slugify(newValue, { lower: true, strict: true })
  }
})

// METHODS

async function rename () {
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
    $q.notify({
      type: 'positive',
      message: t('fileman.renameFolderSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a name already taken alongside this folder answers 409
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(async () => {
  state.loading++
  try {
    const folder = await API_CLIENT.get(`sites/${siteStore.id}/tree/folders/${props.folderId}`).json()
    if (folder?.id !== props.folderId) {
      throw new Error('Failed to fetch folder data.')
    }
    state.path = folder.fileName
    state.title = folder.title
    state.pathDirty = true
  } catch (err) {
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
    onDialogCancel()
  }
  state.loading--
})
</script>
