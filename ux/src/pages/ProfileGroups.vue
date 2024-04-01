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
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'

import { useUserStore } from '@/stores/user'

// QUASAR

const $q = useQuasar()

// STORES

const userStore = useUserStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('profile.avatar')
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

async function fetchGroups () {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.query({
      query: gql`
        query getUserProfileGroups (
          $id: UUID!
        ) {
          userById (
            id: $id
          ) {
            id
            groups {
              id
              name
            }
          }
        }
      `,
      variables: {
        id: userStore.id
      },
      fetchPolicy: 'network-only'
    })
    state.groups = respRaw.data?.userById?.groups ?? []
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
