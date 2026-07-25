<template lang='pug'>
q-page.admin-flags
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-rfid-tag.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.blocks.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.blocks.subtitle') }}
    .col-auto.flex
      template(v-if='flagsStore.experimental')
        q-btn.q-mr-sm.acrylic-btn(
          unelevated
          icon='las la-plus'
          :label='t(`admin.blocks.add`)'
          color='primary'
          @click='addBlock'
        )
        q-separator.q-mr-sm(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/admin/editors`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='refresh'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .q-pa-md.q-gutter-md
    q-card
      q-list(separator)
        q-item(v-for='block of state.blocks', :key='block.id')
          blueprint-icon(:icon='block.isCustom ? `plugin` : block.icon')
          q-item-section
            q-item-label: strong {{ block.name }}
            q-item-label(caption) {{ block.description }}
            q-item-label.flex.items-center(caption)
              q-chip.q-ma-none(square, dense, :color='$q.dark.isActive ? `pink-8` : `pink-1`', :text-color='$q.dark.isActive ? `white` : `pink-9`'): span.text-caption &lt;block-{{ block.block }}&gt;
              q-separator.q-mx-sm.q-my-xs(vertical)
              em.text-purple(v-if='block.isCustom') {{ t('admin.blocks.custom') }}
              em.text-teal-7(v-else) {{ t('admin.blocks.builtin') }}
          template(v-if='block.isCustom')
            q-item-section(
              side
              )
              q-btn(
                icon='las la-trash'
                :aria-label='t(`common.actions.delete`)'
                color='negative'
                outline
                no-caps
                padding='xs sm'
                @click='deleteBlock(block.id)'
              )
            q-separator.q-ml-lg(vertical)
          q-item-section(side)
            q-toggle.q-pr-sm(
              v-model='block.isEnabled'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :label='t(`admin.blocks.isEnabled`)'
              :aria-label='t(`admin.blocks.isEnabled`)'
              )
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { pick } from 'es-toolkit/object'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.editors.title')
})

const state = reactive({
  loading: 0,
  blocks: []
})

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  $q.loading.show()
  load()
})

// METHODS

async function load () {
  state.loading++
  try {
    state.blocks = await API_CLIENT.get(`sites/${adminStore.currentSiteId}/blocks`).json() ?? []
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.blocks.loadFailed'),
      caption: err.message
    })
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}/blocks`, {
      json: {
        states: state.blocks.map(bl => pick(bl, ['id', 'isEnabled']))
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(t(`admin.blocks.${resp?.error}`, resp?.message || 'An unexpected error occured.'))
    }
    $q.notify({
      type: 'positive',
      message: t('admin.blocks.saveSuccess')
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.blocks.saveFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function refresh () {
  await load()
}

function addBlock () {
  // TODO: registering a custom block means uploading a compiled component, which needs an upload
  // endpoint that does not exist yet. Built-in blocks come from the compiled block manifest.
  $q.notify({
    type: 'warning',
    message: t('admin.blocks.addUnavailable')
  })
}

function deleteBlock (id) {
  const block = state.blocks.find(bl => bl.id === id)
  $q.dialog({
    title: t('admin.blocks.delete'),
    message: t('admin.blocks.deleteConfirm', { blockName: block?.name ?? '' }),
    cancel: true,
    persistent: true
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.delete(`sites/${adminStore.currentSiteId}/blocks/${id}`)
      if (!resp?.ok) {
        throw new Error((await resp.json())?.message || 'An unexpected error occured.')
      }
      $q.notify({
        type: 'positive',
        message: t('admin.blocks.deleteSuccess')
      })
      await load()
    } catch (err) {
      // -> ky throws above 400 (e.g. 409 for a built-in block), with the reason in the body
      const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
      $q.notify({
        type: 'negative',
        message: apiMessage || err.message
      })
    }
    state.loading--
  })
}

// MOUNTED

onMounted(async () => {
  $q.loading.show()
  if (adminStore.currentSiteId) {
    await load()
  }
})
</script>

<style lang='scss'>

</style>
