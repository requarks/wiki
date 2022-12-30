<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{t(`fileman.folderCreate`)}}
    q-form.q-py-sm(ref='newFolderForm', @submit='create')
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
            @keyup.enter='create'
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
            @keyup.enter='create'
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
        :label='t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='state.loading > 0'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive, ref, watch } from 'vue'
import slugify from 'slugify'

import { useSiteStore } from 'src/stores/site'

// PROPS

const props = defineProps({
  parentId: {
    type: String,
    default: null
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

const newFolderForm = ref(null)
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

async function create () {
  state.loading++
  try {
    const isFormValid = await newFolderForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('fileman.createFolderInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation createFolder (
          $siteId: UUID!
          $parentId: UUID
          $pathName: String!
          $title: String!
          ) {
          createFolder (
            siteId: $siteId
            parentId: $parentId
            pathName: $pathName
            title: $title
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        siteId: siteStore.id,
        parentId: props.parentId,
        pathName: state.path,
        title: state.title
      }
    })
    if (resp?.data?.createFolder?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('fileman.createFolderSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.createFolder?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}
</script>
