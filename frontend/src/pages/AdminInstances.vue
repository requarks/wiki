<template>
  <w-page class="admin-terminal">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-network.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.instances.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.instances.subtitle') }}
        </div>
      </div>
      <div class="flex-none flex">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/instances`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
      </div>
    </div>
    <w-separator inset />
    <div class="p-4 gap-4">
      <w-card>
        <w-table
          :rows="state.instances"
          :columns="instancesHeaders"
          row-key="name"
          flat
          :loading="state.loading > 0">
          <template v-slot:body-cell-icon="props">
            <w-td :props="props"
              ><w-icon name="la:server" color="positive" size="sm"
            /></w-td>
          </template>
          <template v-slot:body-cell-id="props">
            <w-td :props="props">
              <strong>{{ props.value }}</strong>
              <div>
                <small class="text-grey"
                  ><strong>{{ props.row.ip }}</strong></small
                >
              </div>
              <div>
                <small class="text-grey">{{ props.row.dbUser }}</small>
              </div>
            </w-td>
          </template>
          <template v-slot:body-cell-cons="props">
            <w-td :props="props">
              <w-chip icon="la:plug" square size="md" color="blue" text-color="white">
                <span class="font-robotomono">{{ props.value }}</span>
              </w-chip>
            </w-td>
          </template>
          <template v-slot:body-cell-subs="props">
            <w-td :props="props">
              <w-chip
                icon="la:broadcast-tower"
                square
                size="md"
                color="green"
                text-color="white">
                <small class="uppercase">{{ props.value }}</small>
              </w-chip>
            </w-td>
          </template>
          <template v-slot:body-cell-firstseen="props">
            <w-td :props="props">
              <span>{{ props.value }}</span>
              <div>
                <small class="text-grey">{{ humanizeDate(props.row.dbFirstSeen) }}</small>
              </div>
            </w-td>
          </template>
          <template v-slot:body-cell-lastseen="props">
            <w-td :props="props">
              <span>{{ props.value }}</span>
              <div>
                <small class="text-grey">{{ humanizeDate(props.row.dbLastSeen) }}</small>
              </div>
            </w-td>
          </template>
        </w-table>
      </w-card>
    </div>
  </w-page>
</template>

<script setup>
import { onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { useSiteStore } from '@/stores/site'

import { humanizeDuration, relativeDate } from '@/helpers/datetime'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.instances.title')
})

// DATA

const state = reactive({
  instances: [],
  loading: 0
})

const instancesHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'icon',
    sortable: false,
    style: 'width: 15px; padding-right: 0;'
  },
  {
    label: t('common.field.id'),
    align: 'left',
    field: 'id',
    name: 'id',
    sortable: true
  },
  {
    label: t('admin.instances.activeConnections'),
    align: 'left',
    field: 'activeConnections',
    name: 'cons',
    sortable: true
  },
  {
    label: t('admin.instances.activeListeners'),
    align: 'left',
    field: 'activeListeners',
    name: 'subs',
    sortable: true
  },
  {
    label: t('admin.instances.firstSeen'),
    align: 'left',
    field: 'dbFirstSeen',
    name: 'firstseen',
    sortable: true,
    format: relativeDate
  },
  {
    label: t('admin.instances.lastSeen'),
    align: 'left',
    field: 'dbLastSeen',
    name: 'lastseen',
    sortable: true,
    format: relativeDate
  }
]

// METHODS

/*
  The fields luxon's `fff` expanded to, so the cell reads exactly as before -- long month, no seconds.
  The scheduler spells out seconds in its own copy of this, because there a job's timing is the point.
*/
function humanizeDate(val) {
  if (!val) {
    return '---'
  }
  return Temporal.Instant.from(val).toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

async function load() {
  state.loading++
  try {
    state.instances = await API_CLIENT.get('system/instances').json()
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to load list of instances.',
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  load()
})
</script>
