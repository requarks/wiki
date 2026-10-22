<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-plus-plus.svg" size="sm" class="mr-2" />
        <span>{{ t(`profile.tokensNewTitle`) }}</span>
      </w-card-section>
      <w-form ref="createForm" class="py-2" @submit="create">
        <w-item>
          <blueprint-icon icon="grand-master-key" />
          <w-item-section>
            <w-input
              ref="iptName"
              v-model="state.name"
              outlined
              dense
              :rules="nameValidation"
              hide-bottom-space
              :label="t(`profile.tokensName`)"
              :hint="t(`profile.tokensNameHint`)"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="schedule" />
          <w-item-section>
            <w-select
              v-model="state.expiration"
              outlined
              :options="expirations"
              map-options
              option-value="value"
              option-label="text"
              emit-value
              options-dense
              dense
              hide-bottom-space
              :label="t(`profile.tokensExpiration`)" />
          </w-item-section>
        </w-item>
      </w-form>
      <w-separator inset />
      <w-card-section class="pb-0">
        <div class="text-subtitle2">{{ t('profile.tokensScopes') }}</div>
        <div class="text-caption text-grey">{{ t('profile.tokensScopesHint') }}</div>
      </w-card-section>
      <w-list separator inset-separator class="py-2">
        <w-item v-for="cat of AREA_CATEGORIES" :key="cat.key">
          <w-item-section side>
            <w-icon :name="cat.icon" />
          </w-item-section>
          <w-item-section>
            <w-item-label>{{ t(`profile.tokensScope.${cat.key}`) }}</w-item-label>
            <w-item-label caption>{{ t(`profile.tokensScopeHint.${cat.key}`) }}</w-item-label>
          </w-item-section>
          <w-item-section side>
            <w-btn-toggle
              v-model="state.scopes[cat.key]"
              push
              glossy
              no-caps
              toggle-color="primary"
              :aria-label="t(`profile.tokensScope.${cat.key}`)"
              :options="levels" />
          </w-item-section>
        </w-item>
      </w-list>
      <!--
        Not one more row of the list above: `mcp` names a door rather than an area, and caps what an
        assistant may do in the areas granted there. Absent on a wiki with no MCP server, and offered
        but closed to somebody without use:mcp, saying so.
      -->
      <w-card-section v-if="props.mcp.isEnabled" class="pt-0">
        <div class="rounded border border-black/12 p-4 dark:border-white/15">
          <div class="flex items-center">
            <w-icon
              name="mdi:robot-excited-outline"
              size="24px"
              class="mr-3 text-black/54 dark:text-white/70" />
            <div class="min-w-0 flex-1">
              <div class="text-subtitle2">{{ t('profile.tokensScope.mcp') }}</div>
              <div class="text-caption text-grey">{{ t('profile.tokensMcpHint') }}</div>
            </div>
            <w-btn-toggle
              v-model="state.scopes.mcp"
              class="ml-3"
              push
              glossy
              no-caps
              toggle-color="secondary"
              :disable="!props.mcp.mayUse"
              :aria-label="t('profile.tokensScope.mcp')"
              :options="mcpLevels" />
          </div>
          <w-banner
            v-if="!props.mcp.mayUse"
            class="mt-3"
            rounded
            :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
            <template #avatar>
              <w-icon name="la:ban" />
            </template>
            {{ t('profile.mcpNotAllowed') }}
          </w-banner>
          <template v-else-if="state.scopes.mcp !== `none`">
            <div
              v-if="mcpSummary.length < 1"
              class="text-caption text-deep-orange mt-3 flex items-start">
              <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
              <span>{{ t('profile.tokensMcpNoAreas') }}</span>
            </div>
            <div v-if="mcpSummary.length > 0" class="mt-3 space-y-1">
              <div v-for="line of mcpSummary" :key="line" class="text-caption">{{ line }}</div>
            </div>
            <div
              v-if="props.mcp.isAdministrator"
              class="text-caption text-deep-orange mt-2 flex items-start">
              <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
              <span>{{ t('profile.mcpAdministratorWarning') }}</span>
            </div>
          </template>
        </div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          class="acrylic-btn"
          flat
          :label="t(`common.actions.cancel`)"
          color="cancel"
          padding="xs md"
          @click="onDialogCancel" />
        <w-btn
          unelevated
          :label="t(`common.actions.create`)"
          color="primary"
          padding="xs md"
          :loading="state.loading > 0"
          @click="create" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, reactive, ref } from 'vue'

import { useDark } from '@/composables/dark'
import { dialog, dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { TOKEN_SCOPE_CATEGORIES } from '@/helpers/personalTokens'

import ApiKeyCopyDialog from './ApiKeyCopyDialog.vue'

// PROPS

const props = defineProps({
  /** What the form starts with, for a caller opening it for a purpose — Connect an AI Assistant. */
  presetName: {
    type: String,
    default: ''
  },
  /** Category → level (`read` / `write`) to start from. Every other category starts at none. */
  presetScopes: {
    type: Object,
    default: () => ({})
  },
  /**
   * The MCP server as it stands for this user — the `mcp` of `GET users/profile/tokens`. Pessimistic
   * by default, so a caller that does not say leaves the AI Assistants section out.
   */
  mcp: {
    type: Object,
    default: () => ({ isEnabled: false, mayUse: false, isAdministrator: false })
  }
})

// -> Every category but `mcp`, which is drawn apart from them: it is not an area of its own
const AREA_CATEGORIES = TOKEN_SCOPE_CATEGORIES.filter((cat) => cat.key !== 'mcp')

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const iptName = ref(null)
const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptName.value
})

// COMPOSABLES

const dark = useDark()

// I18N

const { t, locale } = useI18n()

// DATA

const state = reactive({
  name: props.presetName,
  expiration: '90d',
  // -> Nothing granted until somebody asks for it: a token is only as safe as the least it can do
  scopes: {
    ...Object.fromEntries(
      AREA_CATEGORIES.map((cat) => [cat.key, props.presetScopes[cat.key] ?? 'none'])
    ),
    mcp: (props.mcp.isEnabled && props.mcp.mayUse && props.presetScopes.mcp) || 'none'
  },
  loading: 0
})

/*
  Computed, not plain arrays: the locale strings are fetched after the app mounts, so a `t()` called
  once during `setup()` can resolve before they land and leave raw keys showing.

  The API key dialog's lifetimes, worded the same: the API takes the same values for both
  (`ApiKeyExpiration`), so the two kinds of key read alike.
*/
const expirations = computed(() => [
  { value: '7d', text: t('admin.api.expiration7d') },
  { value: '30d', text: t('admin.api.expiration30d') },
  { value: '90d', text: t('admin.api.expiration90d') },
  { value: '180d', text: t('admin.api.expiration180d') },
  { value: '1y', text: t('admin.api.expiration1y') },
  { value: '3y', text: t('admin.api.expiration3y') }
])

const levels = computed(() => [
  { label: t('profile.tokensLevel.none'), value: 'none' },
  { label: t('profile.tokensLevel.read'), value: 'read' },
  { label: t('profile.tokensLevel.write'), value: 'write' }
])

/*
  `write` here grants nothing of its own: it stops blocking the writes the areas above allow, which is
  what the label says rather than "Read & Write".
*/
const mcpLevels = computed(() => [
  { label: t('profile.tokensMcpLevel.none'), value: 'none' },
  { label: t('profile.tokensMcpLevel.read'), value: 'read' },
  { label: t('profile.tokensMcpLevel.write'), value: 'write' }
])

/**
 * What an assistant holding this token could do, a sentence per level: each area at the lower of its
 * own level and the AI Assistants one, which is how `/_mcp` checks a tool (`mcp:<level>` on top of
 * `<category>:<level>`). Empty when no area is granted, which is an assistant that can do nothing.
 */
const mcpSummary = computed(() => {
  const list = new Intl.ListFormat(locale.value, { type: 'conjunction' })
  const isReadOnly = state.scopes.mcp === 'read'
  const granted = AREA_CATEGORIES.filter((cat) => state.scopes[cat.key] !== 'none')
  const names = (cats) => list.format(cats.map((cat) => t(`profile.tokensScope.${cat.key}`)))
  const writable = granted.filter((cat) => state.scopes[cat.key] === 'write')
  const readable = isReadOnly ? granted : granted.filter((cat) => state.scopes[cat.key] === 'read')
  const lines = []
  if (!isReadOnly && writable.length > 0) {
    lines.push(t('profile.tokensMcpCanWrite', { areas: names(writable) }))
  }
  if (readable.length > 0) {
    lines.push(t('profile.tokensMcpCanRead', { areas: names(readable) }))
  }
  if (isReadOnly && writable.length > 0) {
    lines.push(t('profile.tokensMcpWriteBlocked', { areas: names(writable) }))
  }
  return lines
})

// REFS

const createForm = ref(null)

// VALIDATION RULES

const nameValidation = [
  (val) => val.length > 0 || t('profile.tokensNameMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('profile.tokensNameInvalidChars')
]

// METHODS

async function create() {
  state.loading++
  try {
    const isFormValid = await createForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('profile.tokensCreateInvalidData'))
    }
    const scopes = Object.entries(state.scopes)
      .filter(([, level]) => level !== 'none')
      .map(([category, level]) => `${category}:${level}`)
    // -> `mcp` alone opens a door to nothing, so it does not count
    if (!scopes.some((scope) => !scope.startsWith('mcp:'))) {
      throw new Error(t('profile.tokensScopesMissing'))
    }
    const resp = await API_CLIENT.post('users/profile/tokens', {
      json: {
        name: state.name,
        expiration: state.expiration,
        scopes
      }
    }).json()
    if (!resp?.ok || !resp?.token) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('profile.tokensCreateSuccess')
    })
    // -> The token exists only in this response, so hand it straight to the copy dialog
    dialog({
      component: ApiKeyCopyDialog,
      componentProps: {
        keyValue: resp.token,
        title: t('profile.tokensCopyTitle'),
        label: t('profile.tokensToken'),
        successMessage: t('profile.tokensCopySuccess'),
        showMcpSetup: scopes.some((scope) => scope.startsWith('mcp:'))
      }
    }).onDismiss(() => {
      onDialogOK()
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.loading--
}
</script>
