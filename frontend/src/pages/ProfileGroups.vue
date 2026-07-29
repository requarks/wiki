<template>
  <w-page class="py-4">
    <div class="section-header">{{ t('profile.groups') }}</div>
    <div class="p-4">
      <div class="text-body2">{{ t('profile.groupsInfo') }}</div>
      <w-list class="mt-6" bordered separator>
        <w-item v-if="state.groups.length === 0 && state.loading < 1">
          <w-item-section>
            <span class="text-negative">{{ t('profile.groupsNone') }}</span>
          </w-item-section>
        </w-item>
        <w-item v-for="grp of state.groups" :key="grp.id">
          <w-item-section avatar>
            <w-avatar color="secondary" text-color="white" icon="la:users" rounded />
          </w-item-section>
          <w-item-section>
            <strong>{{ grp.name }}</strong>
          </w-item-section>
        </w-item>
      </w-list>
    </div>

    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { onMounted, reactive } from 'vue'

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('profile.groups')
})

// DATA

const state = reactive({
  groups: [],
  loading: 0
})

// METHODS

/**
 * The groups come from the session's own endpoint rather than from `users/:id`: reading an arbitrary
 * user requires `read:users`, which a regular user does not have.
 */
async function fetchGroups() {
  state.loading++
  try {
    const groups = await API_CLIENT.get('users/profile/groups').json()
    state.groups = groups ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('profile.groupsLoadingFailed'),
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  fetchGroups()
})
</script>
