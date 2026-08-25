<template>
  <w-page>
    <div class="flex flex-wrap items-center p-4">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-inspection-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.approval.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.approval.subtitle') }}
        </div>
      </div>
      <div class="flex flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/approvals`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="acrylic-btn mr-2"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="la:plus"
          :label="t(`admin.approval.newRule`)"
          color="primary"
          @click="createRule" />
      </div>
    </div>
    <w-separator inset />
    <div class="p-4">
      <!--
        An empty list is the normal starting state rather than an error, and it is worth saying what
        it means: with no rule matching a page, that page takes no suggestions at all.
      -->
      <w-banner
        v-if="state.rules.length < 1 && state.loading < 1"
        rounded
        :class="dark.isActive ? `bg-dark-3 text-grey-4` : `bg-grey-2 text-grey-8`">
        {{ t('admin.approval.noRules') }}
      </w-banner>
      <w-card v-else>
        <w-list separator>
          <w-item v-for="rule of state.rules" :key="rule.id">
            <blueprint-icon icon="rules" />
            <!--
              A disabled rule keeps everything it says but covers nothing, so it is dimmed rather than
              hidden or moved: it is still part of the configuration being read.
            -->
            <w-item-section :class="rule.isEnabled ? `` : `opacity-60`">
              <w-item-label>
                <strong>{{ rule.name }}</strong>
              </w-item-label>
              <w-item-label caption>
                {{ matchLabel(rule.match) }}
                <span class="font-mono">{{ patternLabel(rule) }}</span>
              </w-item-label>
              <w-item-label caption>
                <span class="text-grey">{{ t('admin.approval.submitters') }}:</span>
                {{ groupNames(rule.submitterGroups) }}
              </w-item-label>
              <w-item-label caption>
                <span class="text-grey">{{ t('admin.approval.reviewers') }}:</span>
                {{ groupNames(rule.reviewerGroups) }}
              </w-item-label>
            </w-item-section>
            <w-item-section side>
              <w-toggle
                :model-value="rule.isEnabled"
                :label="t(`admin.approval.enabled`)"
                :aria-label="t(`admin.approval.enabled`)"
                @update:model-value="
                  (val) => {
                    setEnabled(rule, val)
                  }
                " />
            </w-item-section>
            <w-separator class="ml-4" vertical />
            <w-item-section side style="flex-direction: row; align-items: center">
              <w-btn
                class="acrylic-btn mr-2"
                flat
                @click="editRule(rule)"
                icon="la:pen"
                :color="dark.isActive ? `indigo-4` : `indigo`"
                :label="t(`common.actions.edit`)"
                no-caps />
              <w-btn
                class="acrylic-btn"
                flat
                icon="la:trash"
                color="negative"
                @click="deleteRule(rule)"
                :aria-label="t(`common.actions.delete`)" />
            </w-item-section>
          </w-item>
        </w-list>
      </w-card>
    </div>
    <w-inner-loading :showing="state.loading > 0" />
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'

import { useDark } from '@/composables/dark'
import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { confirm, dialog } from '@/composables/dialog'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import ApprovalRuleDialog from '@/components/ApprovalRuleDialog.vue'
import { apiErrorMessage } from '@/helpers/apiError'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.approval.title')
})

// DATA

const state = reactive({
  loading: 0,
  rules: [],
  groups: []
})

// WATCHERS

watch(() => adminStore.currentSiteId, load)

// METHODS

function matchLabel(match) {
  return (
    {
      START: t('admin.approval.matchStart'),
      EXACT: t('admin.approval.matchExact'),
      END: t('admin.approval.matchEnd'),
      REGEX: t('admin.approval.matchRegex'),
      TAG: t('admin.approval.matchTag'),
      TAGALL: t('admin.approval.matchTagAll')
    }[match] ?? match
  )
}

/** The pattern as it is written in the rule: a path with its slash, or a plain list of tags. */
function patternLabel(rule) {
  if (['TAG', 'TAGALL'].includes(rule.match)) {
    return rule.path
  }
  return rule.match === 'REGEX' ? `/${rule.path}/` : `/${rule.path}`
}

/**
 * Group names for a list of IDs.
 *
 * An ID with no group left to name is shown as-is rather than dropped: a rule pointing at a deleted
 * group grants nothing, and hiding that would make the row look correct.
 */
function groupNames(groupIds) {
  return (groupIds ?? []).map((id) => state.groups.find((g) => g.id === id)?.name ?? id).join(', ')
}

async function load() {
  if (!adminStore.currentSiteId) {
    return
  }
  state.loading++
  try {
    // -> The groups are what turn the stored IDs into names, so both are needed before the list means
    //    anything; fetched together rather than in sequence
    const [rules, groups] = await Promise.all([
      API_CLIENT.get(`sites/${adminStore.currentSiteId}/approvals/rules`).json(),
      API_CLIENT.get('groups').json()
    ])
    state.rules = rules ?? []
    state.groups = groups ?? []
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.approval.loadFailed'),
      caption: apiErrorMessage(err)
    })
  }
  state.loading--
}

/**
 * Turn a rule on or off, saved as soon as the switch moves.
 *
 * The row is updated from the response rather than optimistically: a refused change has to leave the
 * switch showing what the server actually holds.
 */
async function setEnabled(rule, isEnabled) {
  state.loading++
  try {
    const resp = await API_CLIENT.put(
      `sites/${adminStore.currentSiteId}/approvals/rules/${rule.id}`,
      { json: { isEnabled } }
    ).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    Object.assign(rule, resp.rule)
    notify({
      type: 'positive',
      message: isEnabled ? t('admin.approval.enableSuccess') : t('admin.approval.disableSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.approval.saveFailed'),
      caption: apiErrorMessage(err)
    })
    await load()
  }
  state.loading--
}

function createRule() {
  dialog({
    component: ApprovalRuleDialog,
    componentProps: {
      siteId: adminStore.currentSiteId,
      groups: state.groups
    }
  }).onOk(load)
}

function editRule(rule) {
  dialog({
    component: ApprovalRuleDialog,
    componentProps: {
      siteId: adminStore.currentSiteId,
      groups: state.groups,
      rule
    }
  }).onOk(load)
}

function deleteRule(rule) {
  confirm({
    title: t('admin.approval.deleteRule'),
    message: t('admin.approval.deleteRuleConfirm', {
      pattern: `${matchLabel(rule.match)} ${patternLabel(rule)}`
    }),
    cancel: true,
    color: 'negative',
    okLabel: t('common.actions.delete')
  }).onOk(async () => {
    state.loading++
    try {
      const resp = await API_CLIENT.delete(
        `sites/${adminStore.currentSiteId}/approvals/rules/${rule.id}`
      )
      if (!resp?.ok) {
        throw new Error((await resp.json())?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.approval.deleteSuccess')
      })
    } catch (err) {
      notify({
        type: 'negative',
        message: t('admin.approval.deleteFailed'),
        caption: apiErrorMessage(err)
      })
    }
    state.loading--
    await load()
  })
}

// MOUNTED

onMounted(load)
</script>
