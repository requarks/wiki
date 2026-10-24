<template>
  <w-list bordered separator>
    <w-item v-for="token of props.tokens" :key="token.id">
      <w-item-section avatar>
        <!-- -> A connection an MCP client made through OAuth draws as one, since there is no token
             of its own to recognise it by: the client's name, and nothing to copy -->
        <w-avatar
          :color="tokenState(token) ? `negative` : token.client ? `purple` : `secondary`"
          text-color="white"
          :icon="token.client ? `mdi:robot-excited-outline` : `la:stamp`"
          rounded />
      </w-item-section>
      <w-item-section>
        <w-item-label>
          <strong>{{ token.name }}</strong>
          <span v-if="token.client" class="text-caption text-grey ml-2">{{
            t('profile.tokensConnection')
          }}</span>
          <span v-else class="text-caption text-grey ml-2">{{
            t('profile.tokensEndingIn', { suffix: token.keyShort })
          }}</span>
        </w-item-label>
        <div class="flex flex-wrap gap-1 my-1">
          <!--
            Tinted rather than filled: the scopes are detail under the name, not the headline. A
            write scope keeps a hint of the brand colour so it can still be told from a read one at
            a glance. `!` because an uncoloured WChip brings its own neutral background utility, which
            a second one of equal weight cannot be relied on to beat.
          -->
          <w-chip
            v-for="scope of token.scopes"
            :key="scope"
            square
            dense
            size="sm"
            :class="
              scope.endsWith(`:write`)
                ? `!bg-primary/10 text-primary dark:!bg-primary/25 dark:text-primary-light`
                : `text-black/70 dark:text-white/70`
            ">
            {{ scopeLabel(scope) }}
          </w-chip>
        </div>
        <w-item-label caption>
          {{ t('profile.tokensCreatedOn', { date: formatDate(token.createdAt) }) }}
          ·
          <span :class="{ 'text-negative': isTokenExpired(token) }">{{
            t(isTokenExpired(token) ? 'profile.tokensExpiredOn' : 'profile.tokensExpiresOn', {
              date: formatDate(token.expiration)
            })
          }}</span>
          ·
          {{
            token.lastUsedAt
              ? t('profile.tokensLastUsed', { date: formatDate(token.lastUsedAt) })
              : t('profile.tokensNeverUsed')
          }}
        </w-item-label>
        <!-- -> In the row, not in a tooltip: it is why the key beside it has turned red -->
        <w-item-label v-if="tokenState(token) === `invalidated`" caption class="text-negative">
          {{ t('profile.tokensInvalidatedHint') }}
        </w-item-label>
      </w-item-section>
      <w-item-section v-if="props.canDelete" side>
        <w-btn
          class="acrylic-btn"
          flat
          color="negative"
          icon="la:trash-alt"
          :aria-label="t('profile.tokensDelete')"
          @click="emit('delete', token)">
          <w-tooltip anchor="center left" self="center right">{{
            t('profile.tokensDelete')
          }}</w-tooltip>
        </w-btn>
      </w-item-section>
    </w-item>
  </w-list>
</template>

<script setup>
/*
  The rows of a set of personal access tokens, shared by the owner's own list under the profile and
  the one an administrator reads in the user editor. Deleting is the parent's: the two ask different
  endpoints, and only the parent knows which.
*/
import { useI18n } from 'vue-i18n'

import { isTokenExpired, tokenState } from '@/helpers/personalTokens'

import { useUserStore } from '@/stores/user'

// PROPS

const props = defineProps({
  tokens: {
    type: Array,
    required: true
  },
  canDelete: {
    type: Boolean,
    default: false
  }
})

// EMITS

const emit = defineEmits(['delete'])

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()

// METHODS

function formatDate(val) {
  return userStore.formatDate(val)
}

/** `pages:write` as `Pages: Read & Write`. */
function scopeLabel(scope) {
  const [category, level] = scope.split(':')
  return `${t(`profile.tokensScope.${category}`)}: ${t(`profile.tokensLevel.${level}`)}`
}
</script>
