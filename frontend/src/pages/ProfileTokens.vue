<template>
  <w-page class="py-4">
    <div class="w-section-header flex items-center">
      <span>{{ t('profile.tokens') }}</span>
      <w-space />
      <!-- -> Dense, and pulled into the heading's own line height, so it does not make it taller -->
      <w-btn
        v-if="authConfigStore.allowPersonalTokens && state.tab === `tokens`"
        class="-my-1"
        unelevated
        dense
        padding="xs md"
        icon="la:plus"
        color="primary"
        :label="t('profile.tokensNew')"
        :disabled="state.loading > 0"
        @click="createToken" />
    </div>
    <div class="p-4">
      <div class="text-body2">{{ t('profile.tokensInfo') }}</div>
      <!--
        Turned off, the tokens are still listed -- they are kept, and come back if it is turned on
        again -- so that their owner can see them and delete the ones they no longer want.
      -->
      <w-banner
        v-if="!authConfigStore.allowPersonalTokens"
        class="mt-4"
        rounded
        :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
        <template #avatar>
          <w-icon name="la:ban" />
        </template>
        {{ t('profile.tokensDisabled') }}
      </w-banner>
      <w-banner
        v-else-if="!state.isApiEnabled"
        class="mt-4"
        rounded
        :class="dark.isActive ? `bg-dark-4 text-grey-4` : `bg-grey-2 text-grey-8`">
        <template #avatar>
          <w-icon name="la:info-circle" />
        </template>
        {{ t('profile.tokensApiDisabled') }}
      </w-banner>
      <!--
        Two tabs, but only while there is a second one to offer: Connect an AI Assistant is a setup to
        follow, and with the MCP server off or tokens switched off there is nothing to follow.
      -->
      <w-tabs v-if="isMcpOffered" v-model="state.tab" class="mt-4 w-fit" no-caps inline-label>
        <w-tab name="tokens" icon="la:key" :label="t('profile.tokensTabTokens')" />
        <w-tab name="mcp" icon="mdi:robot-excited-outline" :label="t('profile.mcpConnect')" />
      </w-tabs>
      <!--
        Shown to somebody without use:mcp too, saying so, rather than leave them to find out from a
        refused connection.
      -->
      <div
        v-if="isMcpOffered && state.tab === `mcp`"
        class="mt-4 rounded border border-black/12 p-4 dark:border-white/15">
        <div class="flex items-center">
          <img src="/_assets/icons/fluent-ai.svg" alt="" width="32" height="32" />
          <div class="text-body2 ml-3 min-w-0 flex-1">{{ t('profile.mcpConnectHint') }}</div>
        </div>
        <w-banner
          v-if="!state.mcp.mayUse"
          class="mt-3"
          rounded
          :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
          <template #avatar>
            <w-icon name="la:ban" />
          </template>
          {{ t('profile.mcpNotAllowed') }}
        </w-banner>
        <template v-else>
          <mcp-connect-snippets class="mt-4" />
          <div class="text-caption text-grey mt-2">{{ t('profile.mcpScopesHint') }}</div>
          <div
            v-if="state.mcp.isAdministrator"
            class="text-caption text-deep-orange mt-2 flex items-start">
            <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
            <span>{{ t('profile.mcpAdministratorWarning') }}</span>
          </div>
          <div class="mt-4 flex">
            <w-btn
              unelevated
              padding="xs md"
              icon="la:plus"
              color="primary"
              :label="t('profile.mcpCreateToken')"
              @click="createAssistantToken" />
          </div>
        </template>
      </div>
      <!--
        Says what a token is FOR as well as that there are none, since an empty list is where somebody
        lands the first time and the paragraph above is easy to read past. The action is the header's
        own, repeated where the eye already is -- and left out when tokens are switched off, where the
        banner above is the whole story.
      -->
      <template v-else>
        <div
          v-if="state.tokens.length < 1 && state.loading < 1"
          class="mt-6 flex flex-col items-center rounded border border-dashed border-black/12 px-6 py-12 text-center dark:border-white/15">
          <img
            src="/_assets/icons/fluent-bunch-of-keys-animated.svg"
            alt=""
            width="80"
            height="80" />
          <div class="text-h6 mt-4">{{ t('profile.tokensNone') }}</div>
          <div class="text-body2 mt-1 max-w-lg opacity-60">{{ t('profile.tokensNoneHint') }}</div>
          <w-btn
            v-if="authConfigStore.allowPersonalTokens"
            class="acrylic-btn mt-6"
            flat
            icon="la:plus"
            color="primary"
            padding="xs md"
            :label="t('profile.tokensCreateFirst')"
            @click="createToken" />
        </div>
        <personal-token-list
          v-else
          class="mt-4"
          :tokens="state.tokens"
          can-delete
          @delete="deleteToken" />
      </template>
    </div>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { confirm, dialog } from '@/composables/dialog'
import { apiErrorMessage } from '@/helpers/apiError'

import { useAuthConfigStore } from '@/stores/authConfig'

import McpConnectSnippets from '@/components/McpConnectSnippets.vue'
import PersonalTokenCreateDialog from '@/components/PersonalTokenCreateDialog.vue'
import PersonalTokenList from '@/components/PersonalTokenList.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const authConfigStore = useAuthConfigStore()

// I18N

const { t } = useI18n()

// META

useMeta(() => ({
  title: t('profile.tokens')
}))

// DATA

const state = reactive({
  tokens: [],
  /*
    The API being off turns every token off with it. Optimistic until the list says otherwise, so the
    banner does not flash up while it loads.
  */
  isApiEnabled: true,
  // -> Whether to offer Connect an AI Assistant, and what to say in it. Pessimistic, so the card does
  //    not flash up on a wiki that has no MCP server
  mcp: {
    isEnabled: false,
    mayUse: false,
    isAdministrator: false
  },
  tab: 'tokens',
  loading: 0
})

const isMcpOffered = computed(() => state.mcp.isEnabled && authConfigStore.allowPersonalTokens)

// METHODS

async function fetchTokens() {
  state.loading++
  try {
    const resp = await API_CLIENT.get('users/profile/tokens').json()
    state.tokens = resp?.tokens ?? []
    state.isApiEnabled = resp?.isApiEnabled !== false
    state.mcp = { ...state.mcp, ...resp?.mcp }
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.tokensLoadingFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

function createToken() {
  dialog({
    component: PersonalTokenCreateDialog,
    componentProps: {
      mcp: state.mcp
    }
  }).onOk(fetchTokens)
}

/**
 * A token for an assistant, starting read-only through its areas rather than through `mcp`: with
 * `mcp:write` the AI Assistants switch defers to them, so granting an area write in the dialog is all
 * it takes to let the assistant write there. `pages:read` is what reading the wiki needs.
 */
function createAssistantToken() {
  dialog({
    component: PersonalTokenCreateDialog,
    componentProps: {
      presetName: t('profile.mcpTokenName'),
      presetScopes: { mcp: 'write', pages: 'read', glossary: 'read' },
      mcp: state.mcp
    }
  }).onOk(fetchTokens)
}

function deleteToken(token) {
  confirm({
    title: t('common.actions.confirm'),
    message: t('profile.tokensDeleteConfirm', { name: token.name }),
    cancel: true,
    color: 'negative',
    okLabel: t('profile.tokensDelete')
  }).onOk(async () => {
    state.loading++
    try {
      await API_CLIENT.delete(`users/profile/tokens/${token.id}`).json()
      notify({
        type: 'positive',
        message: t('profile.tokensDeleteSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('profile.tokensDeleteFailed'),
        caption: apiErrorMessage(err)
      })
    }
    state.loading--
    await fetchTokens()
  })
}

// MOUNTED

onMounted(fetchTokens)
</script>
