<template>
  <w-card class="icon-picker" flat style="width: 460px">
    <!-- -> `primary` is a mid-tone for white; on the dark card the tabs need the lightened mix -->
    <w-tabs
      class="text-primary dark:text-primary-light"
      v-model="state.currentTab"
      no-caps
      inline-label>
      <w-tab name="icon" icon="la:icons" :label="t(`iconPicker.icons`)" />
      <w-tab name="image" icon="la:image" :label="t(`iconPicker.image`)" />
    </w-tabs>
    <w-separator />
    <w-tab-panels v-model="state.currentTab">
      <!-- ----------------------- -->
      <!-- Iconify search -->
      <!-- ----------------------- -->
      <w-tab-panel class="p-2" name="icon">
        <div class="flex flex-wrap gap-2">
          <div class="min-w-0 flex-1">
            <w-input
              ref="iptSearch"
              v-model="state.query"
              outlined
              dense
              clearable
              :label="t(`iconPicker.search`)"
              :aria-label="t(`iconPicker.search`)"
              @update:model-value="queueSearch">
              <template #prepend><w-icon name="la:search" /></template>
            </w-input>
          </div>
          <div class="flex-none">
            <w-select
              v-model="state.setFilter"
              :options="setOptions"
              outlined
              dense
              options-dense
              emit-value
              map-options
              style="min-width: 130px"
              :label="t(`iconPicker.set`)"
              :aria-label="t(`iconPicker.set`)"
              @update:model-value="search" />
          </div>
        </div>
        <div class="icon-picker-results mt-2">
          <w-inner-loading :showing="state.loading">
            <w-spinner color="primary" size="md" />
          </w-inner-loading>
          <div
            class="text-center text-caption text-grey p-6"
            v-if="!state.loading && state.results.length < 1">
            {{ state.query?.length >= 2 ? t('iconPicker.noResults') : t('iconPicker.searchHint') }}
          </div>
          <div class="icon-picker-grid" v-else>
            <w-btn
              class="icon-picker-cell"
              v-for="icon of state.results"
              :key="icon"
              flat
              dense
              :class="{ 'icon-picker-cell--active': state.selected === icon }"
              :aria-label="icon"
              @click="state.selected = icon">
              <w-icon :name="icon" size="24px" />
              <w-tooltip>{{ icon }}</w-tooltip>
            </w-btn>
          </div>
        </div>
      </w-tab-panel>
      <!-- ----------------------- -->
      <!-- An image file -->
      <!-- ----------------------- -->
      <w-tab-panel class="p-3" name="image">
        <div class="text-caption text-grey">{{ t('iconPicker.imageHint') }}</div>
        <!--
          The field holds the path alone; the `img:` that marks it as an image is shown as a fixed
          prefix and added on the way out. That is how the reference has to be stored -- see WIcon --
          but it is not something anyone should have to know to type.
        -->
        <w-input
          ref="iptImage"
          class="mt-2"
          v-model="state.image"
          outlined
          dense
          prefix="img:"
          :label="t(`iconPicker.imageUrl`)"
          :aria-label="t(`iconPicker.imageUrl`)"
          placeholder="/_assets/icons/my-icon.svg" />
        <div class="mt-2 text-caption text-grey">{{ t('iconPicker.imageSizeHint') }}</div>
      </w-tab-panel>
    </w-tab-panels>
    <w-separator />
    <w-card-section class="flex flex-wrap items-center py-2">
      <w-avatar size="40px" rounded :color="dark.isActive ? `dark-3` : `grey-2`">
        <w-icon :name="pendingValue" size="28px" color="primary" />
      </w-avatar>
      <div class="min-w-0 flex-1 pl-2">
        <div class="text-caption text-grey">{{ t('iconPicker.selection') }}</div>
        <div class="text-body2 icon-picker-ref">{{ pendingValue || '—' }}</div>
      </div>
    </w-card-section>
    <w-separator />
    <w-card-actions>
      <w-space />
      <w-btn
        icon="la:times"
        :label="t(`common.actions.discard`)"
        outline
        color="grey-7"
        @click="closePopup()" />
      <w-btn
        icon="la:check"
        :label="t(`common.actions.apply`)"
        unelevated
        color="secondary"
        :disable="!pendingValue"
        @click="applyAndClose" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'

import { notify } from '@/composables/notify'
import { useDark } from '@/composables/dark'

import { debounce } from 'es-toolkit/function'
import { useClosePopup } from '@/composables/popup'

// I18N

const { t } = useI18n()

const closePopup = useClosePopup()

// PROPS

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  }
})

// EMITS

const emit = defineEmits(['update:modelValue'])

// DATA

const state = reactive({
  currentTab: 'icon',
  query: '',
  setFilter: '',
  sets: [],
  results: [],
  selected: '',
  image: '',
  loading: false
})

/** An Iconify reference, as opposed to an `img:` URL. */
const ICONIFY_REF = /^[a-z0-9-]+:[a-z0-9.-]+$/

/** What marks a reference as an image rather than an icon, per WIcon. */
const IMAGE_PREFIX = 'img:'

// REFS

const iptSearch = ref(null)
const iptImage = ref(null)

// COMPOSABLES

const dark = useDark()

// COMPUTED

const setOptions = computed(() => {
  return [
    { value: '', label: t('iconPicker.allSets') },
    ...state.sets.map((set) => ({ value: set.prefix, label: set.name }))
  ]
})

const pendingValue = computed(() => {
  if (state.currentTab !== 'image') {
    return state.selected
  }
  const url = state.image?.trim()
  return url ? `${IMAGE_PREFIX}${url}` : ''
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

async function loadSets() {
  try {
    // -> Only enabled sets: a disabled one is not searchable, and its icons cannot be stored
    const sets = await API_CLIENT.get('icons/sets').json()
    state.sets = (sets ?? []).filter((set) => set.isEnabled)
  } catch (err) {
    notify({
      type: 'negative',
      message: t('iconPicker.setsFailed'),
      caption: await apiMessage(err)
    })
  }
}

async function search() {
  const query = state.query?.trim()
  if (!query || query.length < 2) {
    state.results = []
    return
  }

  state.loading = true
  try {
    const params = new URLSearchParams({ query })
    if (state.setFilter) {
      params.set('prefixes', state.setFilter)
    }
    const resp = await API_CLIENT.get(`icons/search?${params}`).json()
    state.results = resp?.icons ?? []
  } catch (err) {
    state.results = []
    notify({
      type: 'negative',
      message: t('iconPicker.searchFailed'),
      caption: await apiMessage(err)
    })
  }
  state.loading = false
}

// -> Every keystroke would otherwise be a search against the upstream API
const queueSearch = debounce(search, 350)

/**
 * Hand the reference back, having made sure the wiki can serve it.
 *
 * Drawing the results already stored the ones that were previewed; this covers a reference that was
 * typed rather than picked, and makes the guarantee explicit at the moment content starts pointing at
 * it — from here on the icon is served from the wiki, with or without the Iconify API.
 */
async function apply() {
  const value = pendingValue.value
  emit('update:modelValue', value)

  // -> An image is served from wherever it points; only an icon has to be stored
  if (value.startsWith(IMAGE_PREFIX) || !ICONIFY_REF.test(value)) {
    return
  }
  try {
    await API_CLIENT.post('icons/materialize', { json: { icons: [value] } }).json()
  } catch (err) {
    // -> The reference is saved either way; it just may not render until the icon can be fetched
    notify({
      type: 'warning',
      message: t('iconPicker.materializeFailed', { icon: value }),
      caption: await apiMessage(err)
    })
  }
}

/** Named, because oxfmt breaks a two-statement inline handler onto separate lines */
function applyAndClose() {
  apply()
  closePopup()
}

// MOUNTED

onMounted(async () => {
  // -> An image reference opens on the image tab, an Iconify one on the search tab
  if (props.modelValue?.startsWith(IMAGE_PREFIX)) {
    state.currentTab = 'image'
    state.image = props.modelValue.slice(IMAGE_PREFIX.length)
  } else if (ICONIFY_REF.test(props.modelValue ?? '')) {
    state.selected = props.modelValue
    state.results = [props.modelValue]
  }

  /*
    Focus whichever field the picker just opened on -- the search box, or the image path when an
    `img:` value brought us to that tab. Two ticks: the first renders the tab switch above, and the
    field being focused only exists after the panel it lives in is the visible one.
  */
  await nextTick()
  await nextTick()
  ;(state.currentTab === 'image' ? iptImage : iptSearch).value?.focus()

  await loadSets()
})
</script>

<style lang="scss">
.icon-picker {
  a {
    @at-root .body--light & {
      color: $blue-7;
    }
    @at-root .body--dark & {
      color: $blue-3;
    }
  }

  /* -> A shade off the card, so the fields and the results area read as sitting on a surface */
  .w-tab-panels {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  &-results {
    position: relative;
    height: 220px;
    overflow-y: auto;
    border-radius: 4px;

    @at-root .body--light & {
      background-color: #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }

  &-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 2px;
    padding: 4px;
  }

  &-cell {
    height: 44px;

    &--active {
      @at-root .body--light & {
        background-color: $blue-1;
      }
      @at-root .body--dark & {
        background-color: $blue-9;
      }
    }
  }

  &-ref {
    font-family: monospace;
    word-break: break-all;
  }
}
</style>
