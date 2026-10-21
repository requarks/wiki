<template>
  <div class="oauth-consent">
    <w-card class="oauth-consent-card shadow-2">
      <w-card-section class="flex items-center gap-3">
        <img class="oauth-consent-logo" :src="`/_site/current/logo`" alt="" />
        <div class="min-w-0">
          <div class="text-caption text-grey">{{ siteStore.title }}</div>
          <div class="text-h6">{{ t('oauth.consent.title') }}</div>
        </div>
      </w-card-section>
      <w-separator />

      <w-card-section v-if="state.loading" class="text-body2 text-grey">
        {{ t('oauth.consent.loading') }}
      </w-card-section>

      <!-- -> Nothing to answer: a request this wiki will not take, said plainly -->
      <w-card-section v-else-if="state.failure">
        <div class="text-body2">{{ state.failure }}</div>
        <div v-if="state.failureRedirect" class="mt-4 flex justify-end">
          <w-btn
            unelevated
            color="primary"
            :label="t('oauth.consent.returnToApp')"
            @click="go(state.failureRedirect)" />
        </div>
      </w-card-section>

      <template v-else>
        <w-card-section>
          <i18n-t tag="div" class="text-body1" keypath="oauth.consent.request" scope="global">
            <template #client
              ><strong>{{ state.info.client.name }}</strong></template
            >
            <template #site
              ><strong>{{ siteStore.title }}</strong></template
            >
          </i18n-t>
          <div class="text-caption text-grey mt-2">
            {{ t('oauth.consent.redirectHost', { host: state.info.redirectHost }) }}
          </div>
          <div class="text-caption text-grey mt-1">
            {{ t('oauth.consent.actsAs', { name: userStore.name || userStore.email }) }}
          </div>
        </w-card-section>

        <w-card-section v-if="!state.info.mayUse" class="pt-0">
          <w-banner
            rounded
            :class="dark.isActive ? `bg-orange-9 text-white` : `bg-orange-1 text-orange-9`">
            <template #avatar><w-icon name="la:ban" /></template>
            {{ t('oauth.consent.notAllowed') }}
          </w-banner>
        </w-card-section>

        <template v-else>
          <w-separator />
          <w-list>
            <w-item-label header>{{ t('oauth.consent.scopes') }}</w-item-label>
            <w-item v-for="cat of TOKEN_SCOPE_CATEGORIES" :key="cat.key">
              <w-item-section avatar>
                <w-icon :name="cat.icon" />
              </w-item-section>
              <w-item-section>
                <w-item-label>{{ t(`profile.tokensScope.${cat.key}`) }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-btn-toggle
                  v-model="state.scopes[cat.key]"
                  push
                  glossy
                  no-caps
                  dense
                  toggle-color="primary"
                  :aria-label="t(`profile.tokensScope.${cat.key}`)"
                  :options="cat.key === `mcp` ? mcpLevels : levels" />
              </w-item-section>
            </w-item>
          </w-list>
          <w-card-section class="pt-0">
            <w-select
              v-model="state.expiration"
              outlined
              dense
              :options="expirations"
              map-options
              emit-value
              option-value="value"
              option-label="text"
              hide-bottom-space
              :label="t(`oauth.consent.expiration`)" />
            <div class="text-caption text-grey mt-2">{{ t('oauth.consent.scopesHint') }}</div>
            <div
              v-if="state.info.isAdministrator"
              class="text-caption text-deep-orange mt-2 flex items-start">
              <w-icon class="mr-1 mt-px" name="la:exclamation-triangle" size="xs" />
              <span>{{ t('profile.mcpAdministratorWarning') }}</span>
            </div>
          </w-card-section>
        </template>

        <w-card-actions class="card-actions">
          <w-space />
          <w-btn
            flat
            color="grey"
            padding="xs md"
            :label="t('oauth.consent.deny')"
            :loading="state.submitting === `deny`"
            @click="answer(false)" />
          <w-btn
            v-if="state.info.mayUse"
            unelevated
            color="primary"
            padding="xs md"
            :label="t('oauth.consent.allow')"
            :loading="state.submitting === `allow`"
            @click="answer(true)" />
        </w-card-actions>
      </template>
    </w-card>
  </div>
</template>

<script setup>
/**
 * The OAuth consent screen: an MCP client — a connector in claude.ai or ChatGPT — asking to act as
 * the signed-in person. `/_oauth/authorize` checked the request and sent the browser here with it in
 * the query; the API checks it again (`GET /oauth/authorize`), and the answer goes to
 * `POST /oauth/authorize`, which says where to send the browser back to. See `dev/specs/mcp.md` §4.3.
 *
 * Its own small layout rather than the login screen's: the `.auth` styles belong to `Login.vue`'s
 * chunk and are not loaded on a visit straight to this page.
 */
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { apiErrorMessage } from '@/helpers/apiError'
import { loginLocation } from '@/helpers/loginRedirect'
import { TOKEN_SCOPE_CATEGORIES } from '@/helpers/personalTokens'

import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

const dark = useDark()
const route = useRoute()
const router = useRouter()
const siteStore = useSiteStore()
const userStore = useUserStore()
const { t } = useI18n()

useMeta(() => ({
  title: t('oauth.consent.title')
}))

const state = reactive({
  loading: true,
  failure: '',
  failureRedirect: '',
  submitting: '',
  info: { client: { name: '' }, redirectHost: '', mayUse: false, isAdministrator: false },
  scopes: Object.fromEntries(TOKEN_SCOPE_CATEGORIES.map((cat) => [cat.key, 'none'])),
  expiration: '90d'
})

// -> Computed for the reason the token dialog gives: the strings land after setup runs
const levels = computed(() => [
  { label: t('profile.tokensLevel.none'), value: 'none' },
  { label: t('profile.tokensLevel.read'), value: 'read' },
  { label: t('profile.tokensLevel.write'), value: 'write' }
])
// -> A grant is for the MCP server, so it always holds `mcp` at one level or the other
const mcpLevels = computed(() => levels.value.filter((level) => level.value !== 'none'))
const expirations = computed(() =>
  ['7d', '30d', '90d', '180d', '1y', '3y'].map((value) => ({
    value,
    text: t(`admin.api.expiration${value}`)
  }))
)

/** The request, exactly as it arrived: every parameter is the client's, and is checked server-side. */
const request = computed(() =>
  Object.fromEntries(Object.entries(route.query).filter(([, value]) => typeof value === 'string'))
)

function go(url) {
  window.location.href = url
}

async function load() {
  try {
    const info = await API_CLIENT.get('oauth/authorize', { searchParams: request.value }).json()
    if (info.redirect) {
      state.failure = info.message
      state.failureRedirect = info.redirect
      return
    }
    state.info = info
    for (const scope of info.scopes ?? []) {
      const [category, level] = scope.split(':')
      state.scopes[category] = level
    }
    if (state.scopes.mcp === 'none') {
      state.scopes.mcp = 'read'
    }
  } catch (err) {
    // -> Not signed in: sign in, and come back to this same request
    if (err.response?.status === 401) {
      await router.replace(loginLocation(route.fullPath))
      return
    }
    state.failure = apiErrorMessage(err)
  } finally {
    state.loading = false
  }
}

async function answer(approve) {
  state.submitting = approve ? 'allow' : 'deny'
  try {
    const resp = await API_CLIENT.post('oauth/authorize', {
      json: {
        request: request.value,
        approve,
        ...(approve
          ? {
              scopes: Object.entries(state.scopes)
                .filter(([, level]) => level !== 'none')
                .map(([category, level]) => `${category}:${level}`),
              expiration: state.expiration
            }
          : {})
      }
    }).json()
    go(resp.redirect)
  } catch (err) {
    state.failure = apiErrorMessage(err)
    state.submitting = ''
  }
}

onMounted(load)
</script>

<style lang="scss" scoped>
.oauth-consent {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background-color: $grey-2;

  @at-root .body--dark & {
    background-color: $dark-6;
  }

  &-card {
    width: 100%;
    max-width: 560px;
  }

  &-logo {
    height: 40px;
    width: auto;
  }
}
</style>
