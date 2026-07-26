<template lang='pug'>
q-page.admin-icons
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.admin-icons-icon.animated.fadeInLeft(src='/_assets/icons/fluent-spring.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.icons.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.icons.subtitle') }}
    .col-auto
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/system/icons`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='load'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='las la-plus'
        :label='t(`admin.icons.addSet`)'
        color='primary'
        @click='openAddSet'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg
      //- -----------------------
      //- Icon Sets
      //- -----------------------
      q-card
        q-card-section
          .text-subtitle1 {{ t('admin.icons.sets') }}
          .text-body2.text-grey {{ t('admin.icons.setsHint') }}
        q-banner.q-mx-md.q-mb-md(
          v-if='state.sets.length < 1 && state.loading < 1'
          rounded
          :class='$q.dark.isActive ? `bg-grey-9 text-white` : `bg-grey-2 text-grey-7`'
          ) {{ t('admin.icons.noSets') }}
        q-list(separator)
          q-item(v-for='set of state.sets', :key='set.prefix')
            q-item-section(side)
              .admin-icons-samples
                wiki-icon.admin-icons-sample(
                  v-for='sample of sampleRefs(set)'
                  :key='sample'
                  :name='sample'
                  size='24px'
                )
                q-icon(v-if='sampleRefs(set).length < 1', name='las la-icons', size='24px', color='grey')
            q-item-section
              q-item-label
                strong {{ set.name }}
                q-chip.q-ml-sm(square, dense, size='sm', color='primary', text-color='white') {{ set.prefix }}
              q-item-label(caption) {{ setCaption(set) }}
              q-item-label.text-deep-orange(caption, v-if='set.info?.palette') {{ t('admin.icons.paletteWarn') }}
            q-item-section(side)
              q-btn.acrylic-btn(
                type='a'
                icon='las la-external-link-square-alt'
                :label='t(`admin.icons.reference`)'
                color='indigo'
                flat
                no-caps
                padding='xs md'
                :href='referenceUrl(set)'
                target='_blank'
                rel='noreferrer noopener'
                )
                q-tooltip {{ t('admin.icons.referenceHint') }}
            q-separator.q-ml-md(vertical)
            q-item-section(side)
              q-toggle.q-pr-sm(
                :modelValue='set.isEnabled'
                @update:model-value='newValue => setSetState(set, newValue)'
                color='primary'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                :label='t(`admin.icons.isEnabled`)'
                :aria-label='t(`admin.icons.isEnabled`)'
                )
            q-item-section(side)
              q-btn.acrylic-btn(
                icon='las la-trash'
                flat
                color='negative'
                :aria-label='t(`common.actions.delete`)'
                @click='confirmDeleteSet(set)'
                )
                q-tooltip {{ t(`common.actions.delete`) }}

    .col-12.col-lg-auto
      //- -----------------------
      //- Storage / Cache
      //- -----------------------
      q-card.rounded-borders(style='width: 350px;')
        q-card-section
          .text-subtitle1 {{ t('admin.icons.storage') }}
          .text-body2.text-grey {{ t('admin.icons.storageHint') }}
        q-list.q-pb-sm(dense)
          q-item
            q-item-section
              q-item-label.text-grey {{ t('admin.icons.storedIcons') }}
              q-item-label {{ t('admin.icons.storedIconsValue', { count: state.cache.iconCount ?? 0 }) }}
          q-separator.q-my-sm(inset)
          q-item
            q-item-section
              q-item-label.text-grey {{ t('admin.icons.diskCache') }}
              q-item-label {{ t('admin.icons.diskCacheValue', { count: state.cache.diskCount ?? 0, size: prettyBytes(state.cache.diskSize ?? 0) }) }}
          q-separator.q-my-sm(inset)
          q-item
            q-item-section
              q-item-label.text-grey {{ t('admin.icons.memoryCache') }}
              q-item-label {{ t('admin.icons.memoryCacheValue', { count: state.cache.memoryCount ?? 0 }) }}
        q-separator
        q-card-actions.q-px-md
          q-btn.acrylic-btn(
            flat
            no-caps
            icon='las la-broom'
            color='negative'
            :label='t(`admin.icons.purgeCache`)'
            @click='purgeCache'
          )
            q-tooltip {{ t('admin.icons.purgeCacheHint') }}

      //- -----------------------
      //- How it works
      //- -----------------------
      q-card.rounded-borders.q-mt-md(style='width: 350px;')
        q-card-section
          .text-subtitle1 {{ t('admin.icons.howItWorks') }}
          .text-body2.text-grey.q-mt-sm {{ t('admin.icons.howItWorksHint') }}
        q-separator.q-mb-sm(inset)
        q-item
          q-item-section
            q-item-label.text-grey {{ t('admin.icons.upstream') }}
            q-item-label.text-caption {{ t('admin.icons.upstreamHint') }}

  //- -----------------------
  //- Add Set Dialog
  //- -----------------------
  q-dialog(v-model='state.addSetDialog')
    q-card(style='width: 700px; max-width: 90vw;')
      q-card-section.row.items-center.q-pb-none
        .text-h6 {{ t('admin.icons.addSet') }}
        q-space
        q-btn(icon='las la-times', flat, round, dense, v-close-popup)
      q-card-section
        .text-body2.text-grey {{ t('admin.icons.addSetHint') }}
        q-input.q-mt-md(
          v-model='state.availableFilter'
          outlined
          dense
          clearable
          :label='t(`admin.icons.filterSets`)'
          :aria-label='t(`admin.icons.filterSets`)'
          )
          template(#prepend)
            q-icon(name='las la-search')
      q-separator
      q-card-section.q-pa-none(style='height: 50vh; overflow-y: auto;')
        q-inner-loading(:showing='state.loadingAvailable')
          q-spinner-tail(color='primary', size='md')
        q-banner.q-ma-md(
          v-if='state.availableError'
          rounded
          class='bg-negative text-white'
          ) {{ state.availableError }}
        q-list(separator)
          q-item(
            v-for='set of filteredAvailableSets'
            :key='set.prefix'
            clickable
            :disable='set.isAdded'
            @click='addSet(set)'
            )
            q-item-section(side)
              .admin-icons-samples
                wiki-icon.admin-icons-sample(
                  v-for='sample of set.samples.slice(0, 3)'
                  :key='sample'
                  :name='`${set.prefix}:${sample}`'
                  size='24px'
                )
            q-item-section
              q-item-label
                strong {{ set.name }}
                q-chip.q-ml-sm(square, dense, size='sm', color='primary', text-color='white') {{ set.prefix }}
              q-item-label(caption) {{ availableCaption(set) }}
            q-item-section(side)
              q-chip(v-if='set.isAdded', dense, size='sm', color='positive', text-color='white', icon='las la-check') {{ t('admin.icons.added') }}
              q-icon(v-else, name='las la-plus-circle', color='primary', size='sm')
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive } from 'vue'

import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

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
  if (!filter) { return state.availableSets }
  return state.availableSets.filter(set => {
    return set.name.toLowerCase().includes(filter) ||
      set.prefix.includes(filter) ||
      set.category.toLowerCase().includes(filter)
  })
})

// METHODS

/**
 * Read the API's own message off a failed request, since ky doesn't throw on 400
 */
async function apiMessage (err) {
  return err.response?.json().then(b => b?.message).catch(() => null) ?? err.message
}

function prettyBytes (bytes) {
  if (bytes < 1024) { return `${bytes} B` }
  if (bytes < 1024 * 1024) { return `${(bytes / 1024).toFixed(1)} kB` }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * A few icons of the set to show next to it, from the samples upstream publishes
 */
function sampleRefs (set) {
  return (set.info?.samples ?? []).slice(0, 3).map(sample => `${set.prefix}:${sample}`)
}

/**
 * The Iconify page for the set, which lists every icon it holds with its name.
 *
 * Deliberately not the author's own site: what an administrator needs from here is the names to
 * search for, and the Iconify browser is the catalog those names come from.
 */
function referenceUrl (set) {
  return `https://icon-sets.iconify.design/${set.prefix}/`
}

function setCaption (set) {
  const parts = [t('admin.icons.setIconCount', { count: set.iconCount })]
  if (set.info?.total) {
    parts.push(t('admin.icons.setTotal', { total: set.info.total.toLocaleString() }))
  }
  if (set.info?.license?.title) {
    parts.push(set.info.license.title)
  }
  return parts.join(' • ')
}

function availableCaption (set) {
  return [
    t('admin.icons.setTotal', { total: set.total.toLocaleString() }),
    set.category,
    set.license
  ].filter(Boolean).join(' • ')
}

async function load () {
  state.loading++
  try {
    const [sets, cache] = await Promise.all([
      API_CLIENT.get('icons/sets').json(),
      API_CLIENT.get('icons/cache').json()
    ])
    state.sets = sets ?? []
    state.cache = cache ?? {}
  } catch (err) {
    $q.notify({
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
async function refreshSets () {
  state.loading++
  try {
    await API_CLIENT.post('icons/sets/refresh').json()
  } catch {
    // -> Metadata is a nicety; a wiki with no outbound access still serves every icon it holds
  }
  state.loading--
  await load()
}

async function openAddSet () {
  state.addSetDialog = true
  if (state.availableSets.length > 0) { return }

  state.loadingAvailable = true
  state.availableError = ''
  try {
    state.availableSets = await API_CLIENT.get('icons/available-sets').json() ?? []
  } catch (err) {
    state.availableError = await apiMessage(err)
  }
  state.loadingAvailable = false
}

async function addSet (set) {
  if (set.isAdded) { return }

  state.loading++
  try {
    const resp = await API_CLIENT.post('icons/sets', { json: { prefix: set.prefix } }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    set.isAdded = true
    $q.notify({
      type: 'positive',
      message: t('admin.icons.addSuccess', { set: set.name })
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.icons.addFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
  await load()
}

async function setSetState (set, isEnabled) {
  state.loading++
  try {
    const resp = await API_CLIENT.put(`icons/sets/${set.prefix}`, { json: { isEnabled } }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: isEnabled
        ? t('admin.icons.enableSuccess', { set: set.name })
        : t('admin.icons.disableSuccess', { set: set.name })
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('admin.icons.saveFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading--
  await load()
}

function confirmDeleteSet (set) {
  $q.dialog({
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
      $q.notify({
        type: 'positive',
        message: t('admin.icons.deleteSuccess', { set: set.name })
      })
      // -> The catalog now offers it again
      const available = state.availableSets.find(s => s.prefix === set.prefix)
      if (available) {
        available.isAdded = false
      }
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: t('admin.icons.deleteFailed'),
        caption: await apiMessage(err)
      })
    }
    state.loading--
    await load()
  })
}

function purgeCache () {
  $q.dialog({
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
      $q.notify({
        type: 'positive',
        message: t('admin.icons.purgeCacheSuccess')
      })
    } catch (err) {
      $q.notify({
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
  if (state.sets.some(set => !set.info?.total)) {
    await refreshSets()
  }
})
</script>

<style lang='scss'>
.admin-icons {
  &-icon {
    animation: fadeInLeft .6s forwards, flower-rotate 30s linear infinite;
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
