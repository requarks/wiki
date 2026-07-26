<template lang="pug">
q-page.q-py-md(:style-fn='pageStyle')
  .text-header {{t('profile.groups')}}
  .q-pa-md
    .text-body2 {{ t('profile.groupsInfo') }}
    q-list.q-mt-lg(
      bordered
      separator
      )
      q-item(
        v-if='state.groups.length === 0 && state.loading < 1'
        )
        q-item-section
          span.text-negative {{ t('profile.groupsNone') }}
      q-item(
        v-for='grp of state.groups'
        :key='grp.id'
        )
        q-item-section(avatar)
          q-avatar(
            color='secondary'
            text-color='white'
            icon='las la-users'
            rounded
            )
        q-item-section
          strong {{grp.name}}

  q-inner-loading(:showing='state.loading > 0')
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'

// QUASAR

const $q = useQuasar()

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

function pageStyle (offset, height) {
  return {
    'min-height': `${height - 100 - offset}px`
  }
}

/**
 * The groups come from the session's own endpoint rather than from `users/:id`: reading an arbitrary
 * user requires `read:users`, which a regular user does not have.
 */
async function fetchGroups () {
  state.loading++
  try {
    const groups = await API_CLIENT.get('users/profile/groups').json()
    state.groups = groups ?? []
  } catch (err) {
    $q.notify({
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
