<template>
  <w-card class="page-lifecycle-rule-dialog" style="width: 540px; max-width: 90vw">
    <w-toolbar class="bg-primary text-white">
      <div class="text-subtitle2">
        {{ props.rule ? t('editor.lifecycle.titleEdit') : t('editor.lifecycle.titleNew') }}
      </div>
    </w-toolbar>
    <w-card-section>
      <w-form class="gap-4">
        <w-input
          ref="iptName"
          v-model="state.name"
          :label="t(`editor.lifecycle.name`)"
          outlined
          dense />
        <div class="w-section-header">{{ t('editor.lifecycle.trigger') }}</div>
        <!-- -> Centred, not top-aligned: an outlined input carries vertical margins the select has not -->
        <div class="flex flex-nowrap items-center gap-2">
          <w-select
            class="flex-1"
            v-model="state.trigger"
            :options="triggerOptions"
            :aria-label="t(`editor.lifecycle.trigger`)"
            emit-value
            map-options
            outlined
            dense />
          <w-input
            class="w-28 flex-none"
            v-model.number="state.triggerDays"
            type="number"
            min="1"
            :max="MAX_TRIGGER_DAYS"
            :aria-label="t(`editor.lifecycle.days`)"
            :suffix="t(`editor.lifecycle.daysSuffix`)"
            outlined
            dense />
        </div>
        <div class="w-section-header">{{ t('editor.lifecycle.actions') }}</div>
        <div class="flex flex-col gap-2">
          <!-- -> Each action's own fields sit under its box, and only while it is ticked -->
          <w-checkbox
            v-model="state.banner"
            :label="t(`editor.lifecycle.actionBanner`)"
            :disable="props.bannerTaken && !state.banner" />
          <div v-if="props.bannerTaken && !state.banner" class="text-caption ps-8 opacity-70">
            {{ t('editor.lifecycle.bannerTaken') }}
          </div>
          <div v-if="state.banner" class="flex flex-col ps-8">
            <w-input
              v-model="state.bannerMessage"
              :label="t(`editor.lifecycle.bannerMessage`)"
              outlined
              dense>
              <template #prepend>
                <w-icon :name="state.bannerIcon" size="20px" />
              </template>
              <template #append>
                <w-btn
                  flat
                  dense
                  round
                  icon="la:icons"
                  color="primary"
                  :aria-label="t(`editor.lifecycle.bannerIcon`)">
                  <w-tooltip>{{ t('editor.lifecycle.bannerIcon') }}</w-tooltip>
                  <w-menu content-class="shadow-7" anchor="bottom right" self="top right">
                    <icon-picker-dialog v-model="state.bannerIcon" />
                  </w-menu>
                </w-btn>
              </template>
            </w-input>
          </div>
          <w-checkbox v-model="state.notify" :label="t(`editor.lifecycle.actionNotify`)" />
          <w-checkbox
            v-model="state.move"
            :label="t(`editor.lifecycle.actionMove`)"
            :disable="!mayMove" />
          <div v-if="!mayMove" class="text-caption ps-8 opacity-70">
            {{ t('editor.lifecycle.moveNotAllowed') }}
          </div>
          <div v-if="state.move" class="flex flex-col ps-8">
            <w-input
              v-model="state.movePath"
              :label="t(`editor.lifecycle.movePath`)"
              :hint="
                t(`editor.lifecycle.movePathHint`, {
                  pathName: PAGE_PATH_NAME_PLACEHOLDER,
                  path: PAGE_PATH_PLACEHOLDER
                })
              "
              :disable="!mayMove"
              outlined
              dense />
          </div>
          <w-checkbox
            v-model="state.tags"
            :label="t(`editor.lifecycle.actionTags`)"
            :disable="!mayTag" />
          <div v-if="!mayTag" class="text-caption ps-8 opacity-70">
            {{ t('editor.lifecycle.tagsNotAllowed') }}
          </div>
          <div v-if="state.tags" class="flex flex-col ps-8">
            <w-select
              v-model="state.tagList"
              :options="state.tagOptions"
              :label="t(`editor.lifecycle.tags`)"
              :placeholder="t(`editor.lifecycle.tagsPlaceholder`)"
              :disable="!mayTag"
              outlined
              dense
              options-dense
              use-input
              use-chips
              create
              multiple
              hide-dropdown-icon
              @create="createTag" />
          </div>
          <w-checkbox v-model="state.remove" :label="t(`editor.lifecycle.actionRemove`)" />
          <div v-if="state.remove" class="flex flex-col ps-8">
            <w-input
              class="w-40"
              v-model.number="state.removeAfter"
              type="number"
              min="1"
              :max="MAX_REMOVE_AFTER"
              :aria-label="t(`editor.lifecycle.removeAfter`)"
              :suffix="t(`editor.lifecycle.removeAfterSuffix`)"
              outlined
              dense />
            <div v-if="onlyRemove" class="text-caption opacity-70">
              {{ t('editor.lifecycle.removeOnly') }}
            </div>
          </div>
        </div>
      </w-form>
    </w-card-section>
    <w-card-actions class="card-actions">
      <w-space />
      <w-btn
        class="acrylic-btn"
        icon="la:times"
        :label="t(`common.actions.discard`)"
        color="grey-7"
        padding="xs md"
        flat
        @click="emit('close')" />
      <w-btn
        :disabled="!canSubmit"
        :icon="props.rule ? `la:check` : `la:plus`"
        :label="props.rule ? t(`common.actions.save`) : t(`common.actions.create`)"
        unelevated
        color="primary"
        padding="xs md"
        @click="submit" />
    </w-card-actions>
  </w-card>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import IconPickerDialog from './IconPickerDialog.vue'

/**
 * One lifecycle rule, written or rewritten. Hands the rule back through `save` and changes nothing
 * itself: the properties panel holds the list, and the page's save is what sends it.
 */

// PROPS

const props = defineProps({
  /** The rule being edited, or null for a new one. */
  rule: {
    type: Object,
    default: null
  },
  /** Another rule on the page already shows a banner, so this one may not. */
  bannerTaken: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'save'])

// STORES

const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const { t } = useI18n()

// CONSTANTS

/**
 * Mirror `PAGE_PATH_NAME_PLACEHOLDER`, `PAGE_PATH_PLACEHOLDER`, `MAX_TRIGGER_DAYS` and
 * `MAX_REMOVE_AFTER` in `models/pageLifecycle.ts`.
 */
const PAGE_PATH_NAME_PLACEHOLDER = '{pagePathName}'
const PAGE_PATH_PLACEHOLDER = '{pagePath}'
const MAX_TRIGGER_DAYS = 3650
const MAX_REMOVE_AFTER = 1000
const DEFAULT_BANNER_ICON = 'mdi:clock-alert-outline'
const DEFAULT_MOVE_PATH = `/archived/${PAGE_PATH_NAME_PLACEHOLDER}`

// DATA

const state = reactive({
  name: '',
  trigger: 'contentAge',
  triggerDays: 90,
  banner: false,
  bannerMessage: t('editor.lifecycle.bannerDefaultMessage'),
  bannerIcon: DEFAULT_BANNER_ICON,
  notify: false,
  move: false,
  movePath: DEFAULT_MOVE_PATH,
  tags: false,
  tagList: [],
  tagOptions: [],
  remove: false,
  removeAfter: 1
})

// REFS

const iptName = ref(null)

// COMPUTED

const triggerOptions = computed(() => [
  { label: t('editor.lifecycle.triggerContentAge'), value: 'contentAge' },
  { label: t('editor.lifecycle.triggerInterval'), value: 'interval' },
  { label: t('editor.lifecycle.triggerCommentAge'), value: 'commentAge' }
])

/*
  The two actions a rule carries out as its author that need more than writing the page: the server
  asks the same of a rule that is new or changed (`PUT …/lifecycle-rules`). Page permissions, so read
  off what the session holds at this page rather than through `can()`.
*/
const mayMove = computed(() => userStore.pagePermissions.includes('manage:pages'))
const mayTag = computed(() => userStore.pagePermissions.includes('write:tags'))

const actions = computed(() => {
  const list = []
  if (state.banner) {
    list.push({ kind: 'banner', message: state.bannerMessage.trim(), icon: state.bannerIcon })
  }
  if (state.notify) {
    list.push({ kind: 'notify' })
  }
  if (state.move) {
    list.push({ kind: 'move', path: state.movePath.trim() })
  }
  if (state.tags) {
    list.push({ kind: 'tags', tags: state.tagList })
  }
  if (state.remove) {
    list.push({ kind: 'remove', after: state.removeAfter })
  }
  return list
})

// -> Removing itself is not something a rule can do and nothing else: it would do nothing, then go
const onlyRemove = computed(() => actions.value.every((action) => action.kind === 'remove'))

const canSubmit = computed(
  () =>
    state.name.trim().length > 0 &&
    Number.isInteger(state.triggerDays) &&
    state.triggerDays >= 1 &&
    state.triggerDays <= MAX_TRIGGER_DAYS &&
    actions.value.length > 0 &&
    !onlyRemove.value &&
    actions.value.every(
      (action) =>
        (action.kind !== 'banner' || action.message) &&
        (action.kind !== 'move' || action.path) &&
        (action.kind !== 'tags' || action.tags.length > 0) &&
        (action.kind !== 'remove' ||
          (Number.isInteger(action.after) && action.after >= 1 && action.after <= MAX_REMOVE_AFTER))
    )
)

// METHODS

/** Tags typed in, one or several at once, separated as the page's own tag field separates them. */
function createTag(val) {
  const typed = val
    .split(/[,;]+/)
    .map((v) => v.trim())
    .filter(Boolean)
  for (const tag of typed) {
    if (!state.tagOptions.includes(tag)) {
      state.tagOptions.push(tag)
    }
    if (!state.tagList.includes(tag)) {
      state.tagList = [...state.tagList, tag]
    }
  }
}

function submit() {
  emit('save', {
    ...props.rule,
    name: state.name.trim(),
    trigger: state.trigger,
    triggerDays: state.triggerDays,
    actions: actions.value
  })
  emit('close')
}

// MOUNTED

onMounted(async () => {
  if (props.rule) {
    state.name = props.rule.name
    state.trigger = props.rule.trigger
    state.triggerDays = props.rule.triggerDays
    for (const action of props.rule.actions) {
      if (action.kind === 'banner') {
        state.banner = true
        state.bannerMessage = action.message
        state.bannerIcon = action.icon || DEFAULT_BANNER_ICON
      } else if (action.kind === 'notify') {
        state.notify = true
      } else if (action.kind === 'move') {
        state.move = true
        state.movePath = action.path
      } else if (action.kind === 'tags') {
        state.tags = true
        state.tagList = [...action.tags]
      } else if (action.kind === 'remove') {
        state.remove = true
        state.removeAfter = action.after
      }
    }
  }
  nextTick(() => iptName.value?.focus())

  // -> Suggestions only: without them the field still takes whatever is typed
  try {
    await siteStore.fetchTags()
    state.tagOptions = [
      ...new Set([...siteStore.tags.map((tag) => tag.tag), ...state.tagList])
    ].sort((a, b) => a.localeCompare(b))
  } catch (err) {
    console.warn(err)
  }
})
</script>

<style lang="scss">
/*
  The section headings edge to edge, as in the properties panel: `.w-section-header` carries its own
  16px inset and expects a column with none, so the card section's padding is cancelled at the sides.
*/
.page-lifecycle-rule-dialog .w-section-header {
  margin-inline: -16px;
}
</style>
