<template>
  <div class="mcp-connect-snippets">
    <w-btn-toggle
      v-model="state.client"
      push
      glossy
      no-caps
      toggle-color="primary"
      :aria-label="t('profile.mcpClient')"
      :options="clientOptions" />
    <!-- -> Boxed and with its copy button beside it, as every other value here meant to be pasted
         elsewhere is. `pre` keeps a JSON snippet's indentation; `break-all` keeps a long command
         from pushing the button off the end -->
    <div class="mt-2 flex items-start gap-2">
      <pre
        class="text-caption font-robotomono m-0 min-w-0 flex-1 whitespace-pre-wrap break-all rounded border border-black/12 bg-black/4 px-3 py-2 dark:border-white/15 dark:bg-white/6"
        >{{ snippet }}</pre>
      <w-btn
        class="acrylic-btn shrink-0"
        icon="la:copy"
        flat
        dense
        color="secondary"
        :aria-label="t(`common.actions.copy`)"
        @click="copy">
        <w-tooltip>{{ t(`common.actions.copy`) }}</w-tooltip>
      </w-btn>
    </div>
  </div>
</template>

<script setup>
/**
 * The setup for one MCP client at a time, picked from the clients in `helpers/mcpClients.js`, with a
 * copy button. Given a `token`, the snippet carries it; without one, a placeholder stands in.
 */
import { useI18n } from 'vue-i18n'
import { computed, reactive } from 'vue'

import { notify } from '@/composables/notify'
import { copyToClipboard } from '@/helpers/clipboard'
import { MCP_CLIENTS, TOKEN_PLACEHOLDER, mcpEndpointUrl } from '@/helpers/mcpClients'

const props = defineProps({
  token: {
    type: String,
    default: ''
  }
})

const { t } = useI18n()

const state = reactive({
  client: MCP_CLIENTS[0].key
})

const clientOptions = MCP_CLIENTS.map((client) => ({ label: client.label, value: client.key }))

const snippet = computed(() => {
  const client = MCP_CLIENTS.find((entry) => entry.key === state.client) ?? MCP_CLIENTS[0]
  return client.snippet(mcpEndpointUrl(), props.token || TOKEN_PLACEHOLDER)
})

async function copy() {
  await copyToClipboard(snippet.value)
  notify({
    type: 'positive',
    message: t('profile.mcpSnippetCopied')
  })
}
</script>
