<template>
  <w-page class="admin-icons">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon admin-icons-icon animated fadeInLeft"
          src="/_assets/icons/fluent-spring.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.icons.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.icons.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/icons`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.icons.addSet`)"
          color="primary"
          @click="openAddSet" />
      </div>
    </div>
    <w-separator inset />
    <div class="flex flex-wrap gap-4 p-4">
      <div class="w-full lg:min-w-0 lg:flex-1">
        <!-- ----------------------- -->
        <!-- Icon Sets -->
        <!-- ----------------------- -->
        <w-card>
          <w-card-header>
            {{ t('admin.icons.sets') }}
            <template #hint>{{ t('admin.icons.setsHint') }}</template>
          </w-card-header>
          <w-banner
            class="mx-4 mb-4"
            v-if="state.sets.length < 1 && state.loading < 1"
            :class="dark.isActive ? `bg-grey-9 text-white` : `bg-grey-2 text-grey-7`"
            >{{ t('admin.icons.noSets') }}</w-banner
          >
          <w-list separator>
            <w-item v-for="set of state.sets" :key="set.prefix">
              <w-item-section side>
                <div class="admin-icons-samples">
                  <w-icon
                    class="admin-icons-sample"
                    v-for="sample of sampleRefs(set)"
                    :key="sample"
                    :name="sample"
                    size="24px" />
                  <w-icon
                    v-if="sampleRefs(set).length < 1"
                    name="la:icons"
                    size="24px"
                    color="grey" />
                </div>
              </w-item-section>
              <w-item-section>
                <w-item-label>
                  <strong>{{ set.name }}</strong>
                  <w-chip class="ml-2" square dense size="sm" color="primary" text-color="white">{{
                    set.prefix
                  }}</w-chip>
                </w-item-label>
                <w-item-label caption>{{ setCaption(set) }}</w-item-label>
                <w-item-label class="text-deep-orange" caption v-if="set.info?.palette">{{
                  t('admin.icons.paletteWarn')
                }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-btn
                  class="acrylic-btn"
                  icon="la:external-link-square-alt"
                  :label="t(`admin.icons.reference`)"
                  color="indigo"
                  flat
                  no-caps
                  padding="xs md"
                  :href="referenceUrl(set)"
                  target="_blank">
                  <w-tooltip>{{ t('admin.icons.referenceHint') }}</w-tooltip>
                </w-btn>
              </w-item-section>
              <w-separator class="ml-4" vertical />
              <w-item-section side>
                <w-toggle
                  class="pr-2"
                  :modelValue="set.isEnabled"
                  @update:model-value="(newValue) => setSetState(set, newValue)"
                  :label="t(`admin.icons.isEnabled`)"
                  :aria-label="t(`admin.icons.isEnabled`)" />
              </w-item-section>
              <w-item-section side>
                <w-btn
                  class="acrylic-btn"
                  icon="la:trash"
                  flat
                  color="negative"
                  :aria-label="t(`common.actions.delete`)"
                  @click="confirmDeleteSet(set)">
                  <w-tooltip>{{ t(`common.actions.delete`) }}</w-tooltip>
                </w-btn>
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
      </div>
      <div class="w-full lg:w-auto">
        <!-- ----------------------- -->
        <!-- Storage / Cache -->
        <!-- ----------------------- -->
        <w-card class="rounded" style="width: 350px">
          <w-card-header>
            {{ t('admin.icons.storage') }}
            <template #hint>{{ t('admin.icons.storageHint') }}</template>
          </w-card-header>
          <w-list class="pb-2" dense>
            <w-item>
              <w-item-section>
                <w-item-label class="text-grey">{{ t('admin.icons.storedIcons') }}</w-item-label>
                <w-item-label>{{
                  t('admin.icons.storedIconsValue', { count: state.cache.iconCount ?? 0 })
                }}</w-item-label>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <w-item-section>
                <w-item-label class="text-grey">{{ t('admin.icons.diskCache') }}</w-item-label>
                <w-item-label>{{
                  t('admin.icons.diskCacheValue', {
                    count: state.cache.diskCount ?? 0,
                    size: prettyBytes(state.cache.diskSize ?? 0)
                  })
                }}</w-item-label>
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <w-item-section>
                <w-item-label class="text-grey">{{ t('admin.icons.memoryCache') }}</w-item-label>
                <w-item-label>{{
                  t('admin.icons.memoryCacheValue', { count: state.cache.memoryCount ?? 0 })
                }}</w-item-label>
              </w-item-section>
            </w-item>
          </w-list>
          <w-separator />
          <w-card-actions class="px-4">
            <w-btn
              class="acrylic-btn"
              flat
              no-caps
              icon="la:broom"
              color="negative"
              :label="t(`admin.icons.purgeCache`)"
              @click="purgeCache">
              <w-tooltip>{{ t('admin.icons.purgeCacheHint') }}</w-tooltip>
            </w-btn>
          </w-card-actions>
        </w-card>
        <!-- ----------------------- -->
        <!-- How it works -->
        <!-- ----------------------- -->
        <w-card class="rounded mt-4" style="width: 350px">
          <w-card-header>
            {{ t('admin.icons.howItWorks') }}
            <template #hint>{{ t('admin.icons.howItWorksHint') }}</template>
          </w-card-header>
          <w-separator class="mb-2" inset />
          <w-item>
            <w-item-section>
              <w-item-label class="text-grey">{{ t('admin.icons.upstream') }}</w-item-label>
              <w-item-label class="text-caption">{{ t('admin.icons.upstreamHint') }}</w-item-label>
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
    <!-- ----------------------- -->
    <!-- Add Set Dialog -->
    <!-- ----------------------- -->
    <w-dialog v-model="state.addSetDialog">
      <w-card style="width: 700px; max-width: 90vw">
        <w-card-section class="flex flex-wrap items-center pb-0">
          <div class="text-h6">{{ t('admin.icons.addSet') }}</div>
          <w-space />
          <w-btn icon="la:times" flat round dense @click="state.addSetDialog = false" />
        </w-card-section>
        <w-card-section>
          <div class="text-body2 text-grey">{{ t('admin.icons.addSetHint') }}</div>
          <w-input
            class="mt-4"
            v-model="state.availableFilter"
            outlined
            dense
            clearable
            :label="t(`admin.icons.filterSets`)"
            :aria-label="t(`admin.icons.filterSets`)">
            <template #prepend><w-icon name="la:search" /></template>
          </w-input>
        </w-card-section>
        <w-separator />
        <w-card-section class="p-0" style="height: 50vh; overflow-y: auto">
          <w-inner-loading :showing="state.loadingAvailable">
            <w-spinner color="primary" size="md" />
          </w-inner-loading>
          <w-banner class="m-4 bg-negative text-white" v-if="state.availableError">{{
            state.availableError
          }}</w-banner>
          <w-list separator>
            <w-item
              v-for="set of filteredAvailableSets"
              :key="set.prefix"
              clickable
              :disable="set.isAdded"
              @click="addSet(set)">
              <w-item-section side>
                <div class="admin-icons-samples">
                  <w-icon
                    class="admin-icons-sample"
                    v-for="sample of set.samples.slice(0, 3)"
                    :key="sample"
                    :name="`${set.prefix}:${sample}`"
                    size="24px" />
                </div>
              </w-item-section>
              <w-item-section>
                <w-item-label>
                  <strong>{{ set.name }}</strong>
                  <w-chip class="ml-2" square dense size="sm" color="primary" text-color="white">{{
                    set.prefix
                  }}</w-chip>
                </w-item-label>
                <w-item-label caption>{{ availableCaption(set) }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-chip
                  v-if="set.isAdded"
                  dense
                  size="sm"
                  color="positive"
                  text-color="white"
                  icon="la:check"
                  >{{ t('admin.icons.added') }}</w-chip
                >
                <w-icon v-else name="la:plus-circle" color="primary" size="sm" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card-section>
      </w-card>
    </w-dialog>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { dialog } from '@/composables/dialog'

import { useSiteStore } from '@/stores/site'

// COMPOSABLES

const dark = useDark()

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.icons.title')
})

// DATA

const state = reactive({
  loading: 0,
  sets: [],
  cache: {},
  addSetDialog: false,
  availableSets: [],
  availableFilter: '',
  availableError: '',
  loadingAvailable: false
})

// COMPUTED

const filteredAvailableSets = computed(() => {
  const filter = state.availableFilter?.trim().toLowerCase()
  if (!filter) {
    return state.availableSets
  }
  return state.availableSets.filter((set) => {
    return (
      set.name.toLowerCase().includes(filter) ||
      set.prefix.includes(filter) ||
      set.category.toLowerCase().includes(filter)
    )
  })
})

// METHODS

/**
 * Read the API's own message off a failed request, since ky doesn't throw on 400
 */
async function apiMessage(err) {
  return (
    err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null) ?? err.message
  )
}

function prettyBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * A few icons of the set to show next to it, from the samples upstream publishes
 */
function sampleRefs(set) {
  return (set.info?.samples ?? []).slice(0, 3).map((sample) => `${set.prefix}:${sample}`)
}

/**
 * The Iconify page for the set, which lists every icon it holds with its name.
 *
 * Deliberately not the author's own site: what an administrator needs from here is the names to
 * search for, and the Iconify browser is the catalog those names come from.
 */
function referenceUrl(set) {
  return `https://icon-sets.iconify.design/${set.prefix}/`
}

function setCaption(set) {
  const parts = [t('admin.icons.setIconCount', { count: set.iconCount })]
  if (set.info?.total) {
    parts.push(t('admin.icons.setTotal', { total: set.info.total.toLocaleString() }))
  }
  if (set.info?.license?.title) {
    parts.push(set.info.license.title)
  }
  return parts.join(' • ')
}

function availableCaption(set) {
  return [
    t('admin.icons.setTotal', { total: set.total.toLocaleString() }),
    set.category,
    set.license
  ]
    .filter(Boolean)
    .join(' • ')
}

async function load() {
  state.loading++
  try {
    const [sets, cache] = await Promise.all([
      API_CLIENT.get('icons/sets').json(),
      API_CLIENT.get('icons/cache').json()
    ])
    state.sets = sets ?? []
    state.cache = cache ?? {}
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.icons.loadFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
}

/**
 * Bring the set metadata up to date with upstream, then reload.
 *
 * Sets seeded at install time have no metadata until this runs, since installing must not depend on
 * outbound access.
 */
async function refreshSets() {
  state.loading++
  try {
    await API_CLIENT.post('icons/sets/refresh').json()
  } catch {
    // -> Metadata is a nicety; a wiki with no outbound access still serves every icon it holds
  }
  state.loading--
  await load()
}

async function openAddSet() {
  state.addSetDialog = true
  if (state.availableSets.length > 0) {
    return
  }

  state.loadingAvailable = true
  state.availableError = ''
  try {
    state.availableSets = (await API_CLIENT.get('icons/available-sets').json()) ?? []
  } catch (err) {
    state.availableError = await apiMessage(err)
  }
  state.loadingAvailable = false
}

async function addSet(set) {
  if (set.isAdded) {
    return
  }

  state.loading++
  try {
    const resp = await API_CLIENT.post('icons/sets', { json: { prefix: set.prefix } }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    set.isAdded = true
    notify({
      type: 'positive',
      message: t('admin.icons.addSuccess', { set: set.name })
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.icons.addFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
  await load()
}

async function setSetState(set, isEnabled) {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`icons/sets/${set.prefix}`, { json: { isEnabled } }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: isEnabled
        ? t('admin.icons.enableSuccess', { set: set.name })
        : t('admin.icons.disableSuccess', { set: set.name })
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.icons.saveFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
  await load()
}

function confirmDeleteSet(set) {
  dialog({
    title: t('admin.icons.deleteSet'),
    message: t('admin.icons.deleteSetConfirm', { set: set.name, count: set.iconCount }),
    persistent: true,
    ok: {
      label: t('common.actions.delete'),
      color: 'negative',
      unelevated: true
    },
    cancel: {
      label: t('common.actions.cancel'),
      color: 'grey',
      flat: true
    }
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.delete(`icons/sets/${set.prefix}`).json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.icons.deleteSuccess', { set: set.name })
      })
      // -> The catalog now offers it again
      const available = state.availableSets.find((s) => s.prefix === set.prefix)
      if (available) {
        available.isAdded = false
      }
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.icons.deleteFailed'),
        caption: await apiMessage(err)
      })
    }
    state.loading--
    await load()
  })
}

function purgeCache() {
  dialog({
    title: t('admin.icons.purgeCache'),
    message: t('admin.icons.purgeCacheConfirm'),
    persistent: true,
    ok: {
      label: t('admin.icons.purgeCache'),
      color: 'negative',
      unelevated: true
    },
    cancel: {
      label: t('common.actions.cancel'),
      color: 'grey',
      flat: true
    }
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.delete('icons/cache').json()
      if (!resp?.ok) {
        throw new Error(resp?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.icons.purgeCacheSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.icons.purgeCacheFailed'),
        caption: await apiMessage(err)
      })
    }
    state.loading--
    await load()
  })
}

// MOUNTED

onMounted(async () => {
  await load()
  // -> A set with no metadata has never been described by upstream: seeded at install, or added while
  //    the API was unreachable
  if (state.sets.some((set) => !set.info?.total)) {
    await refreshSets()
  }
})
</script>

<style lang="scss">
.admin-icons {
  &-icon {
    animation:
      fadeInLeft 0.6s forwards,
      flower-rotate 30s linear infinite;
  }

  &-samples {
    display: flex;
    gap: 4px;
    width: 84px;
  }

  &-sample {
    color: $blue-8;

    body.body--dark & {
      color: $blue-3;
    }
  }
}

@keyframes flower-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
