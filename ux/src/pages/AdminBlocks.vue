<template lang='pug'>
q-page.admin-flags
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-rfid-tag.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.blocks.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.blocks.subtitle') }}
    .col-auto.flex
      template(v-if='flagsStore.experimental')
        q-btn.q-mr-sm.acrylic-btn(
          unelevated
          icon='las la-plus'
          :label='t(`admin.blocks.add`)'
          color='primary'
          @click='addBlock'
        )
        q-separator.q-mr-sm(vertical)
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :aria-label='t(`common.actions.viewDocs`)'
        :href='siteStore.docsBase + `/admin/editors`'
        target='_blank'
        type='a'
        )
        q-tooltip {{ t(`common.actions.viewDocs`) }}
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        :aria-label='t(`common.actions.refresh`)'
        @click='refresh'
        )
        q-tooltip {{ t(`common.actions.refresh`) }}
      q-btn(
        unelevated
        icon='mdi-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .q-pa-md.q-gutter-md
    q-card
      q-list(separator)
        q-item(v-for='block of state.blocks', :key='block.id')
          blueprint-icon(:icon='block.isCustom ? `plugin` : block.icon')
          q-item-section
            q-item-label: strong {{ block.name }}
            q-item-label(caption) {{ block.description }}
            q-item-label.flex.items-center(caption)
              q-chip.q-ma-none(square, dense, :color='$q.dark.isActive ? `pink-8` : `pink-1`', :text-color='$q.dark.isActive ? `white` : `pink-9`'): span.text-caption &lt;block-{{ block.block }}&gt;
              q-separator.q-mx-sm.q-my-xs(vertical)
              em.text-purple(v-if='block.isCustom') {{ t('admin.blocks.custom') }}
              em.text-teal-7(v-else) {{ t('admin.blocks.builtin') }}
          template(v-if='block.isCustom')
            q-item-section(
              side
              )
              q-btn(
                icon='las la-trash'
                :aria-label='t(`common.actions.delete`)'
                color='negative'
                outline
                no-caps
                padding='xs sm'
                @click='deleteBlock(block.id)'
              )
            q-separator.q-ml-lg(vertical)
          q-item-section(side)
            q-toggle.q-pr-sm(
              v-model='block.isEnabled'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :label='t(`admin.blocks.isEnabled`)'
              :aria-label='t(`admin.blocks.isEnabled`)'
              disable
              )
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import { defineAsyncComponent, onMounted, reactive, watch } from 'vue'
import gql from 'graphql-tag'
import { cloneDeep, pick } from 'lodash-es'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.editors.title')
})

const state = reactive({
  loading: 0,
  blocks: []
})

// WATCHERS

watch(() => adminStore.currentSiteId, (newValue) => {
  $q.loading.show()
  load()
})

// METHODS

async function load () {
  state.loading++
  try {
    const resp = await APOLLO_CLIENT.query({
      query: gql`
        query getSiteBlocks (
          $siteId: UUID!
        ) {
        blocks (
          siteId: $siteId
        ) {
          id
          block
          name
          description
          icon
          isEnabled
          isCustom
          config
        }
      }`,
      variables: {
        siteId: adminStore.currentSiteId
      },
      fetchPolicy: 'network-only'
    })
    state.blocks = cloneDeep(resp?.data?.blocks)
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to fetch blocks state.'
    })
  }
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation saveSiteBlocks (
          $siteId: UUID!
          $states: [BlockStateInput]!
          ) {
          setBlocksState (
            siteId: $siteId,
            states: $states
            ) {
            operation {
              succeeded
              slug
              message
            }
          }
        }
      `,
      variables: {
        siteId: adminStore.currentSiteId,
        states: state.blocks.map(bl => pick(bl, ['id', 'isEnabled']))
      }
    })
    if (respRaw?.data?.setBlocksState?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.blocks.saveSuccess')
      })
    } else {
      throw new Error(respRaw?.data?.setBlocksState?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save site blocks state',
      caption: err.message
    })
  }
  state.loading--
}

async function refresh () {
  await load()
}

function addBlock () {

}

function deleteBlock (id) {

}

// MOUNTED

onMounted(async () => {
  $q.loading.show()
  if (adminStore.currentSiteId) {
    await load()
  }
})
</script>

<style lang='scss'>

</style>
