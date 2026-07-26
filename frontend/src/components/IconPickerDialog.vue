<template lang="pug">
q-card.icon-picker(flat, style='width: 460px')
  q-tabs.text-primary(
    v-model='state.currentTab'
    no-caps
    inline-label
    )
    q-tab(
      name='icon'
      icon='las la-icons'
      :label='t(`iconPicker.icons`)'
      )
    q-tab(
      name='custom'
      icon='las la-pen'
      :label='t(`iconPicker.custom`)'
      )
  q-separator
  q-tab-panels(v-model='state.currentTab')
    //- -----------------------
    //- Iconify search
    //- -----------------------
    q-tab-panel.q-pa-sm(name='icon')
      .row.q-col-gutter-sm
        .col
          q-input(
            v-model='state.query'
            outlined
            dense
            clearable
            autofocus
            :label='t(`iconPicker.search`)'
            :aria-label='t(`iconPicker.search`)'
            @update:model-value='queueSearch'
            )
            template(#prepend)
              q-icon(name='las la-search')
        .col-auto
          q-select(
            v-model='state.setFilter'
            :options='setOptions'
            outlined
            dense
            options-dense
            emit-value
            map-options
            style='min-width: 130px;'
            :label='t(`iconPicker.set`)'
            :aria-label='t(`iconPicker.set`)'
            @update:model-value='search'
          )
      .icon-picker-results.q-mt-sm
        q-inner-loading(:showing='state.loading')
          q-spinner-tail(color='primary', size='md')
        .text-center.text-caption.text-grey.q-pa-lg(v-if='!state.loading && state.results.length < 1')
          | {{ state.query?.length >= 2 ? t('iconPicker.noResults') : t('iconPicker.searchHint') }}
        .icon-picker-grid(v-else)
          q-btn.icon-picker-cell(
            v-for='icon of state.results'
            :key='icon'
            flat
            dense
            :class='{ "icon-picker-cell--active": state.selected === icon }'
            :aria-label='icon'
            @click='state.selected = icon'
            )
            wiki-icon(:name='icon', size='24px')
            q-tooltip {{ icon }}
    //- -----------------------
    //- Anything else
    //- -----------------------
    q-tab-panel(name='custom')
      .text-caption.text-grey {{ t('iconPicker.customHint') }}
      q-input.q-mt-sm(
        v-model='state.custom'
        outlined
        dense
        :label='t(`iconPicker.reference`)'
        :aria-label='t(`iconPicker.reference`)'
        placeholder='las la-home'
      )
  q-separator
  q-card-section.row.items-center.q-py-sm
    q-avatar(size='40px', rounded, :color='$q.dark.isActive ? `dark-3` : `grey-2`')
      wiki-icon(:name='pendingValue', size='28px', color='primary')
    .col.q-pl-sm
      .text-caption.text-grey {{ t('iconPicker.selection') }}
      .text-body2.icon-picker-ref {{ pendingValue || '—' }}
  q-separator
  q-card-actions
    q-space
    q-btn(
      icon='las la-times'
      :label='t(`common.actions.discard`)'
      outline
      color='grey-7'
      v-close-popup
    )
    q-btn(
      icon='las la-check'
      :label='t(`common.actions.apply`)'
      unelevated
      color='secondary'
      :disable='!pendingValue'
      @click='apply'
      v-close-popup
    )
</template>

<script setup>
import { debounce } from 'es-toolkit/function'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

// QUASAR

const $q = useQuasar()

// I18N

const { t } = useI18n()

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

// COMPUTED

const setOptions = computed(() => {
  return [
    { value: '', label: t('iconPicker.allSets') },
    ...state.sets.map(set => ({ value: set.prefix, label: set.name }))
  ]
})

const pendingValue = computed(() => {
  return state.currentTab === 'custom' ? (state.custom?.trim() ?? '') : state.selected
})

// METHODS

/**
 * Read the API's own message off a failed request, since ky doesn't throw on 400
 */
async function apiMessage (err) {
  return err.response?.json().then(b => b?.message).catch(() => null) ?? err.message
}

async function loadSets () {
  try {
    // -> Only enabled sets: a disabled one is not searchable, and its icons cannot be stored
    const sets = await API_CLIENT.get('icons/sets').json()
    state.sets = (sets ?? []).filter(set => set.isEnabled)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: t('iconPicker.setsFailed'),
      caption: await apiMessage(err)
    })
  }
}

async function search () {
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
    $q.notify({
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
async function apply () {
  const value = pendingValue.value
  emit('update:modelValue', value)

  if (!ICONIFY_REF.test(value)) {
    return
  }
  try {
    await API_CLIENT.post('icons/materialize', { json: { icons: [value] } }).json()
  } catch (err) {
    // -> The reference is saved either way; it just may not render until the icon can be fetched
    $q.notify({
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

  .q-input .q-field__control, .q-select .q-field__control {
    @at-root .body--light & {
      background-color: #FFF;
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
      background-color: #FFF;
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
