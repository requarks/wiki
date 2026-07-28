<template>
  <w-card class="icon-picker" flat style="width: 460px">
    <w-tabs class="text-primary" v-model="state.currentTab" no-caps inline-label>
      <w-tab name="icon" icon="la:icons" :label="t(`iconPicker.icons`)" />
      <w-tab name="custom" icon="la:pen" :label="t(`iconPicker.custom`)" />
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
              v-model="state.query"
              outlined
              dense
              clearable
              autofocus
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
              style="min-width: 130px;"
              :label="t(`iconPicker.set`)"
              :aria-label="t(`iconPicker.set`)"
              @update:model-value="search" />
          </div>
        </div>
        <div class="icon-picker-results mt-2">
          <w-inner-loading :showing="state.loading">
            <w-spinner color="primary" size="md" />
          </w-inner-loading>
          <div class="text-center text-caption text-grey p-6" v-if="!state.loading && state.results.length < 1">{{ state.query?.length >= 2 ? t('iconPicker.noResults') : t('iconPicker.searchHint') }}</div>
          <div class="icon-picker-grid" v-else>
            <w-btn
              class="icon-picker-cell"
              v-for="icon of state.results"
              :key="icon"
              flat
              dense
              :class='{ "icon-picker-cell--active": state.selected === icon }'
              :aria-label="icon"
              @click="state.selected = icon">
              <w-icon :name="icon" size="24px" />
              <w-tooltip>{{ icon }}</w-tooltip>
            </w-btn>
          </div>
        </div>
      </w-tab-panel>
      <!-- ----------------------- -->
      <!-- Anything else -->
      <!-- ----------------------- -->
      <w-tab-panel name="custom">
        <div class="text-caption text-grey">{{ t('iconPicker.customHint') }}</div>
        <w-input
          class="mt-2"
          v-model="state.custom"
          outlined
          dense
          :label="t(`iconPicker.reference`)"
          :aria-label="t(`iconPicker.reference`)"
          placeholder="la:home" />
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
        @click="apply(); closePopup()" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

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
  custom: '',
  loading: false
})

/** An Iconify reference, as opposed to a webfont name or an `img:` URL. */
const ICONIFY_REF = /^[a-z0-9-]+:[a-z0-9.-]+$/

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
  return state.currentTab === 'custom' ? (state.custom?.trim() ?? '') : state.selected
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

  if (!ICONIFY_REF.test(value)) {
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

// MOUNTED

onMounted(async () => {
  // -> An Iconify reference starts on the search tab, anything else on the custom one
  if (ICONIFY_REF.test(props.modelValue ?? '')) {
    state.selected = props.modelValue
    state.results = [props.modelValue]
  } else if (props.modelValue) {
    state.currentTab = 'custom'
    state.custom = props.modelValue
  }
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

  .q-tab-panels {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  .q-input .q-field__control,
  .q-select .q-field__control {
    @at-root .body--light & {
      background-color: #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
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
