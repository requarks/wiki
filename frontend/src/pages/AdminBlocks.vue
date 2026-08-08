<template>
  <w-page class="admin-flags">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-plugin.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.blocks.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.blocks.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <template v-if="flagsStore.experimental">
          <w-btn
            class="mr-2 acrylic-btn"
            unelevated
            icon="la:plus"
            :label="t(`admin.blocks.add`)"
            color="primary"
            @click="addBlock" />
          <w-separator class="mr-2" vertical />
        </template>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/editors`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="refresh">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="p-4 gap-4">
      <w-card>
        <w-list separator>
          <w-item v-for="block of state.blocks" :key="block.id">
            <blueprint-icon :icon="block.isCustom ? `plugin` : block.icon" />
            <w-item-section>
              <w-item-label
                ><strong>{{ block.name }}</strong></w-item-label
              >
              <w-item-label caption>{{ block.description }}</w-item-label>
              <w-item-label class="flex items-center" caption>
                <w-chip
                  class="m-0"
                  square
                  dense
                  :color="dark.isActive ? `pink-8` : `pink-1`"
                  :text-color="dark.isActive ? `white` : `pink-9`">
                  <span class="text-caption">&lt;block-{{ block.block }}&gt;</span>
                </w-chip>
                <w-separator class="mx-2 my-1" vertical />
                <em class="text-purple" v-if="block.isCustom">{{ t('admin.blocks.custom') }}</em>
                <em class="text-teal-7" v-else>{{ t('admin.blocks.builtin') }}</em>
              </w-item-label>
            </w-item-section>
            <template v-if="block.isCustom">
              <w-item-section side>
                <w-btn
                  icon="la:trash"
                  :aria-label="t(`common.actions.delete`)"
                  color="negative"
                  outline
                  no-caps
                  padding="xs sm"
                  @click="deleteBlock(block.id)" />
              </w-item-section>
              <w-separator class="ml-6" vertical />
            </template>
            <w-item-section side>
              <w-toggle
                class="pr-2"
                v-model="block.isEnabled"
                :label="t(`admin.blocks.isEnabled`)"
                :aria-label="t(`admin.blocks.isEnabled`)" />
            </w-item-section>
          </w-item>
        </w-list>
      </w-card>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'
import { dialog } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

import { pick } from 'es-toolkit/object'
import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

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

watch(
  () => adminStore.currentSiteId,
  (newValue) => {
    loading.show()
    load()
  }
)

// METHODS

async function load() {
  state.loading++
  try {
    state.blocks = (await API_CLIENT.get(`sites/${adminStore.currentSiteId}/blocks`).json()) ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.blocks.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`sites/${adminStore.currentSiteId}/blocks`, {
      json: {
        states: state.blocks.map((bl) => pick(bl, ['id', 'isEnabled']))
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.blocks.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.blocks.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.blocks.saveFailed'),
      caption: err.message
    })
  }
  state.loading--
}

async function refresh() {
  await load()
}

function addBlock() {
  // TODO: registering a custom block means uploading a compiled component, which needs an upload
  // endpoint that does not exist yet. Built-in blocks come from the compiled block manifest.
  notify({
    type: 'warning',
    message: t('admin.blocks.addUnavailable')
  })
}

function deleteBlock(id) {
  const block = state.blocks.find((bl) => bl.id === id)
  dialog({
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
      notify({
        type: 'positive',
        message: t('admin.blocks.deleteSuccess')
      })
      await load()
    } catch (err) {
      // -> ky throws above 400 (e.g. 409 for a built-in block), with the reason in the body
      notify({
        type: 'negative',
        message: apiErrorMessage(err)
      })
    }
    state.loading--
  })
}

// MOUNTED

onMounted(async () => {
  loading.show()
  if (adminStore.currentSiteId) {
    await load()
  }
})
</script>

<style lang="scss"></style>
