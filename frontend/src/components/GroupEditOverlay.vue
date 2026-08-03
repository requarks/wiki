<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-people.svg" left size="md" />
      <div>
        <span>{{ t(`admin.groups.edit`) }}</span>
        <div class="text-caption">{{ state.group.name }}</div>
      </div>
      <w-space />
      <w-btn-group push>
        <w-btn
          push
          color="grey-6"
          text-color="white"
          :aria-label="t(`common.actions.refresh`)"
          icon="la:redo-alt"
          @click="refresh">
          <w-tooltip anchor="center left" self="center right">{{
            t(`common.actions.refresh`)
          }}</w-tooltip>
        </w-btn>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.close`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.save`)"
          icon="la:check"
          :loading="state.isLoading"
          @click="save" />
      </w-btn-group>
    </w-header>
    <w-drawer class="bg-dark-6" :model-value="true" :width="250" dark>
      <w-list padding dark v-show="!state.isLoading">
        <template v-for="sc of sections" :key="`section-` + sc.key">
          <w-item
            v-if="!(isGuestGroup && sc.excludeGuests)"
            clickable
            :to="{ params: { section: sc.key } }"
            active-class="bg-primary text-white"
            :disabled="sc.disabled">
            <w-item-section side><w-icon :name="sc.icon" color="white" /></w-item-section>
            <w-item-section>{{ sc.text }}</w-item-section>
            <w-item-section side v-if="sc.usersTotal">
              <w-badge color="dark-3" :label="state.usersTotal" />
            </w-item-section>
            <w-item-section side v-if="sc.rulesTotal && state.group.rules">
              <w-badge color="dark-3" :label="state.group.rules.length" />
            </w-item-section>
          </w-item>
        </template>
      </w-list>
    </w-drawer>
    <w-page-container>
      <w-page v-if="state.isLoading" />
      <!-- ----------------------------------------------------------------------- -->
      <!-- OVERVIEW -->
      <!-- ----------------------------------------------------------------------- -->
      <w-page v-else-if="route.params.section === `overview`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.groups.general') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="team" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.groups.name`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.groups.nameHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.group.name"
                      dense
                      :rules="groupNameValidation"
                      hide-bottom-space
                      :aria-label="t(`admin.groups.name`)"
                      :disable="isGuestGroup" />
                  </w-item-section>
                </w-item>
              </w-card>
              <w-card class="shadow-1 pb-2 mt-4" v-if="!isGuestGroup">
                <w-card-header>{{ t('admin.groups.authBehaviors') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="double-right" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.groups.redirectOnLogin`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.groups.redirectOnLoginHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.group.redirectOnLogin"
                      dense
                      :aria-label="t(`admin.groups.redirectOnLogin`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="chevron-right" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.groups.redirectOnFirstLogin`) }}</w-item-label>
                    <w-item-label caption>{{
                      t(`admin.groups.redirectOnFirstLoginHint`)
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.group.redirectOnFirstLogin"
                      dense
                      :aria-label="t(`admin.groups.redirectOnLogin`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="exit" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.groups.redirectOnLogout`) }}</w-item-label>
                    <w-item-label caption>{{
                      t(`admin.groups.redirectOnLogoutHint`)
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.group.redirectOnLogout"
                      dense
                      :aria-label="t(`admin.groups.redirectOnLogout`)" />
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
            <div class="col-span-12 lg:col-span-4">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.groups.info') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="team" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`common.field.id`) }}</w-item-label>
                    <w-item-label
                      ><strong>{{ state.group.id }}</strong></w-item-label
                    >
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="calendar-plus" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`common.field.createdOn`) }}</w-item-label>
                    <w-item-label>
                      <strong>{{ humanizeDate(state.group.createdAt) }}</strong>
                    </w-item-label>
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="summertime" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`common.field.lastUpdated`) }}</w-item-label>
                    <w-item-label>
                      <strong>{{ humanizeDate(state.group.updatedAt) }}</strong>
                    </w-item-label>
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
          </div>
        </div>
      </w-page>
      <!-- ----------------------------------------------------------------------- -->
      <!-- RULES -->
      <!-- ----------------------------------------------------------------------- -->
      <w-page v-else-if="route.params.section === `rules`">
        <w-toolbar class="pl-4" :class="dark.isActive ? `bg-dark-3` : `bg-white`">
          <div class="text-subtitle1">{{ t('admin.groups.rules') }}</div>
          <w-space />
          <w-btn
            class="acrylic-btn mr-2"
            icon="la:question-circle"
            flat
            color="grey"
            type="a"
            :href="siteStore.docsBase + `/admin/groups#rules`"
            target="_blank" />
          <w-btn
            class="acrylic-btn mr-2"
            flat
            color="indigo"
            icon="la:file-export"
            @click="exportRules">
            <w-tooltip>{{ t('admin.groups.exportRules') }}</w-tooltip>
          </w-btn>
          <w-btn
            class="acrylic-btn mr-2"
            flat
            color="indigo"
            icon="la:file-import"
            @click="importRules">
            <w-tooltip>{{ t('admin.groups.importRules') }}</w-tooltip>
          </w-btn>
          <w-btn unelevated color="primary" icon="la:plus" label="New Rule" @click="newRule" />
        </w-toolbar>
        <w-separator />
        <div class="p-4">
          <w-banner
            v-if="!state.group.rules || state.group.rules.length < 1"
            rounded
            :class="dark.isActive ? `bg-negative text-white` : `bg-grey-4 text-grey-9`"
            >{{ t('admin.groups.rulesNone') }}</w-banner
          >
          <w-card class="shadow-1 pb-2" v-else>
            <w-card-section>
              <div class="admin-groups-rule" v-for="rule of state.group.rules" :key="rule.id">
                <div class="admin-groups-rule-icon" :class="getRuleModeColor(rule.mode)">
                  <w-icon
                    :name="getRuleModeIcon(rule.mode)"
                    color="white"
                    @click="rule.mode = getNextRuleMode(rule.mode)" />
                </div>
                <div class="admin-groups-rule-name">
                  <div class="admin-groups-rule-name-text">
                    <strong :class="getRuleModeColor(rule.mode)">{{
                      getRuleModeName(rule.mode)
                    }}</strong>
                  </div>
                  <w-separator class="ml-2 mr-1" vertical />
                  <input type="text" v-model="rule.name" placeholder="Rule Name" />
                </div>
                <w-card class="admin-groups-rule-card mt-4" flat>
                  <w-card-section
                    class="admin-groups-rule-card-permissions"
                    :class="getRuleModeClass(rule.mode)">
                    <w-select
                      class="mt-1"
                      standout
                      v-model="rule.roles"
                      emit-value
                      map-options
                      dense
                      :aria-label="t(`admin.groups.ruleSites`)"
                      :options="ruleOptions"
                      placeholder="Select permissions..."
                      option-value="permission"
                      option-label="title"
                      options-dense
                      multiple
                      use-chips
                      stack-label>
                      <template #selected-item="scope">
                        <w-chip
                          square
                          dense
                          :tabindex="scope.tabindex"
                          :color="getRuleModeBgColor(rule.mode)"
                          text-color="white">
                          <span class="text-caption">{{ scope.opt.title }}</span>
                        </w-chip>
                      </template>
                      <template #option="{ itemProps, itemEvents, opt, selected, toggleOption }">
                        <w-item v-bind="itemProps" v-on="itemEvents">
                          <w-item-section side>
                            <w-toggle
                              :model-value="selected"
                              @update:model-value="toggleOption(opt)"
                              color="primary"
                              checked-icon="la:check"
                              unchecked-icon="la:times"
                              :aria-label="opt.label" />
                          </w-item-section>
                          <!-- q-item-section(side, style='flex-basis: 150px;') -->
                          <!-- q-chip.text-caption( -->
                          <!-- square -->
                          <!-- color='teal' -->
                          <!-- text-color='white' -->
                          <!-- dense -->
                          <!-- ) {{opt.permission}} -->
                          <w-item-section>
                            <w-item-label>{{ opt.title }}</w-item-label>
                            <w-item-label caption>{{ opt.hint }}</w-item-label>
                          </w-item-section>
                        </w-item>
                      </template>
                    </w-select>
                    <w-btn
                      class="acrylic-btn ml-4"
                      flat
                      icon="la:trash"
                      color="negative"
                      padding="sm sm"
                      size="md"
                      @click="deleteRule(rule.id)" />
                  </w-card-section>
                  <w-card-section horizontal>
                    <w-card-section class="admin-groups-rule-card-filters">
                      <div class="text-caption">Applies to...</div>
                      <w-select
                        class="mt-1"
                        standout
                        v-model="rule.sites"
                        emit-value
                        map-options
                        dense
                        :aria-label="t(`admin.groups.ruleSites`)"
                        :options="adminStore.sites"
                        option-value="id"
                        option-label="title"
                        multiple
                        behavior="dialog"
                        :display-value="
                          t(`admin.groups.selectedSites`, rule.sites.length, {
                            count: rule.sites.length
                          })
                        ">
                        <template #option="{ itemProps, itemEvents, opt, selected, toggleOption }">
                          <w-item v-bind="itemProps" v-on="itemEvents">
                            <w-item-section>
                              <w-item-label>{{ opt.title }}</w-item-label>
                            </w-item-section>
                            <w-item-section side>
                              <w-toggle
                                :model-value="selected"
                                @update:model-value="toggleOption(opt)"
                                color="primary"
                                checked-icon="la:check"
                                unchecked-icon="la:times"
                                :aria-label="opt.label" />
                            </w-item-section>
                          </w-item>
                        </template>
                      </w-select>
                      <w-select
                        class="mt-2"
                        standout
                        v-model="rule.locales"
                        emit-value
                        map-options
                        dense
                        :aria-label="t(`admin.groups.ruleLocales`)"
                        :options="adminStore.locales"
                        option-value="code"
                        option-label="name"
                        multiple
                        behavior="dialog"
                        :display-value="
                          t(
                            `admin.groups.selectedLocales`,
                            {
                              n:
                                rule.locales.length > 0
                                  ? rule.locales[0].toUpperCase()
                                  : rule.locales.length
                            },
                            rule.locales.length
                          )
                        ">
                        <template #option="{ itemProps, opt, selected, toggleOption }">
                          <w-item v-bind="itemProps">
                            <w-item-section>
                              <w-item-label>{{ opt.name }}</w-item-label>
                            </w-item-section>
                            <w-item-section side>
                              <w-toggle
                                :model-value="selected"
                                @update:model-value="toggleOption(opt)"
                                color="primary"
                                checked-icon="la:check"
                                unchecked-icon="la:times"
                                :aria-label="opt.name" />
                            </w-item-section>
                          </w-item>
                        </template>
                      </w-select>
                    </w-card-section>
                    <w-card-section class="admin-groups-rule-card-pattern">
                      <div class="text-caption">Pattern</div>
                      <w-select
                        class="mt-1"
                        standout
                        v-model="rule.match"
                        emit-value
                        map-options
                        dense
                        :aria-label="t(`admin.groups.ruleMatch`)"
                        :options="[
                          { label: t('admin.groups.ruleMatchStart'), value: 'START' },
                          { label: t('admin.groups.ruleMatchEnd'), value: 'END' },
                          { label: t('admin.groups.ruleMatchRegex'), value: 'REGEX' },
                          { label: t('admin.groups.ruleMatchTag'), value: 'TAG' },
                          { label: t('admin.groups.ruleMatchTagAll'), value: 'TAGALL' },
                          { label: t('admin.groups.ruleMatchExact'), value: 'EXACT' }
                        ]" />
                      <w-input
                        class="mt-2"
                        standout
                        v-model="rule.path"
                        dense
                        :prefix="[`START`, `REGEX`, `EXACT`].includes(rule.match) ? `/` : null"
                        :suffix="rule.match === `REGEX` ? `/` : null"
                        :aria-label="t(`admin.groups.rulePath`)" />
                    </w-card-section>
                  </w-card-section>
                </w-card>
              </div>
            </w-card-section>
          </w-card>
        </div>
      </w-page>
      <!-- ----------------------------------------------------------------------- -->
      <!-- PERMISSIONS -->
      <!-- ----------------------------------------------------------------------- -->
      <w-page v-else-if="route.params.section === `permissions`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-6">
              <w-card class="shadow-1 pb-2">
                <w-card-header>
                  {{ t(`admin.groups.permissions`) }}
                  <template #action>
                    <w-btn
                      class="acrylic-btn"
                      icon="la:question-circle"
                      flat
                      color="grey"
                      type="a"
                      :href="siteStore.docsBase + `/admin/groups#permissions`"
                      target="_blank" />
                  </template>
                </w-card-header>
                <template v-for="(perm, idx) of permissions" :key="perm.permission">
                  <w-item tag="label">
                    <w-item-section class="items-center" style="flex: 0 0 40px">
                      <w-icon name="la:comments" color="primary" size="sm" />
                    </w-item-section>
                    <w-item-section>
                      <w-item-label>{{ perm.permission }}</w-item-label>
                      <w-item-label caption>{{ perm.hint }}</w-item-label>
                    </w-item-section>
                    <w-item-section avatar>
                      <w-toggle
                        v-model="state.group.permissions"
                        :val="perm.permission"
                        color="primary"
                        checked-icon="la:check"
                        unchecked-icon="la:times"
                        :aria-label="t(`admin.general.allowComments`)" />
                    </w-item-section>
                  </w-item>
                  <w-separator class="my-2" inset v-if="idx < permissions.length - 1" />
                </template>
              </w-card>
            </div>
          </div>
        </div>
      </w-page>
      <!-- ----------------------------------------------------------------------- -->
      <!-- USERS -->
      <!-- ----------------------------------------------------------------------- -->
      <w-page v-else-if="route.params.section === `users`">
        <w-toolbar :class="dark.isActive ? `bg-dark-3` : `bg-white`">
          <div class="text-subtitle1">{{ t('admin.groups.users') }}</div>
          <w-space />
          <w-btn
            class="acrylic-btn mr-2"
            icon="la:question-circle"
            flat
            color="grey"
            type="a"
            :href="siteStore.docsBase + `/admin/groups#users`"
            target="_blank" />
          <w-input
            class="denser fill-outline mr-2"
            outlined
            v-model="state.usersFilter"
            :placeholder="t(`admin.groups.filterUsers`)"
            dense>
            <template #prepend><w-icon name="la:search" /></template>
          </w-input>
          <w-btn
            class="mr-2 acrylic-btn"
            icon="la:redo-alt"
            flat
            color="secondary"
            @click="refreshUsers" />
          <w-btn
            class="mr-1"
            unelevated
            icon="la:user-plus"
            :label="t(`admin.groups.assignUser`)"
            color="primary"
            @click="assignUser" />
        </w-toolbar>
        <w-separator />
        <div class="p-4">
          <w-banner
            v-if="!state.users || state.users.length < 1"
            rounded
            :class="dark.isActive ? `bg-negative text-white` : `bg-grey-4 text-grey-9`"
            >{{ t('admin.groups.usersNone') }}</w-banner
          >
          <w-card class="shadow-1">
            <w-table
              :rows="state.users"
              :columns="usersHeaders"
              row-key="id"
              flat
              hide-header
              :loading="state.isLoadingUsers">
              <template #body-cell-id="props">
                <w-td :props="props"><w-icon name="la:user" color="primary" size="sm" /></w-td>
              </template>
              <template #body-cell-name="props">
                <w-td :props="props">
                  <div class="flex items-center">
                    <strong>{{ props.value }}</strong>
                    <w-icon class="ml-2" v-if="props.row.isSystem" name="la:lock" color="pink" />
                    <w-icon class="ml-2" v-if="!props.row.isActive" name="la:ban" color="pink" />
                  </div>
                </w-td>
              </template>
              <template #body-cell-email="props">
                <w-td :props="props"
                  ><em>{{ props.value }}</em></w-td
                >
              </template>
              <template #body-cell-date="props">
                <w-td :props="props">
                  <i18n-t class="text-caption" keypath="admin.users.createdAt" tag="div">
                    <template #date
                      ><strong>{{ humanizeDate(props.value) }}</strong></template
                    >
                  </i18n-t>
                  <i18n-t
                    class="text-caption"
                    v-if="props.row.lastLoginAt"
                    keypath="admin.users.lastLoginAt"
                    tag="div">
                    <template #date>
                      <strong>{{ humanizeDate(props.row.lastLoginAt) }}</strong>
                    </template>
                  </i18n-t>
                </w-td>
              </template>
              <template #body-cell-edit="props">
                <w-td :props="props">
                  <w-btn
                    class="acrylic-btn mr-2"
                    v-if="!props.row.isSystem"
                    flat
                    :to="`/_admin/users/` + props.row.id"
                    icon="la:pen"
                    color="indigo"
                    :label="t(`common.actions.edit`)"
                    no-caps />
                  <!-- Hidden for system users: the guest account's membership is fixed, and the API -->
                  <!-- refuses to change it either way -->
                  <w-btn
                    class="acrylic-btn"
                    v-if="!props.row.isSystem"
                    flat
                    icon="la:user-minus"
                    color="accent"
                    :aria-label="t(`admin.groups.unassignUser`)"
                    @click="unassignUser(props.row)">
                    <w-tooltip anchor="center left" self="center right">{{
                      t('admin.groups.unassignUser')
                    }}</w-tooltip>
                  </w-btn>
                </w-td>
              </template>
            </w-table>
          </w-card>
          <div class="flex items-center justify-center mt-4" v-if="usersTotalPages > 1">
            <w-pagination
              v-model="state.usersPage"
              :max="usersTotalPages"
              :max-pages="9"
              boundary-numbers
              direction-links />
          </div>
        </div>
      </w-page>
    </w-page-container>
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { confirm, dialog } from '@/composables/dialog'
import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'

import { useAdminStore } from '@/stores/admin'
import { useSiteStore } from '@/stores/site'

import { v4 as uuid } from 'uuid'
import { fileOpen, fileSave } from 'browser-fs-access'
import UserSearchDialog from '@/components/UserSearchDialog.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  group: {
    rules: []
  },
  isLoading: false,
  users: [],
  isLoadingUsers: false,
  usersFilter: '',
  usersPage: 1,
  usersPageSize: 15,
  usersTotal: 0
})

const sections = [
  { key: 'overview', text: t('admin.groups.overview'), icon: 'la:users' },
  { key: 'rules', text: t('admin.groups.rules'), icon: 'la:file-invoice', rulesTotal: true },
  {
    key: 'permissions',
    text: t('admin.groups.permissions'),
    icon: 'la:list-alt',
    excludeGuests: true
  },
  {
    key: 'users',
    text: t('admin.groups.users'),
    icon: 'la:user',
    usersTotal: true,
    excludeGuests: true
  }
]

const usersHeaders = [
  {
    align: 'center',
    field: 'id',
    name: 'id',
    sortable: false,
    style: 'width: 20px'
  },
  {
    label: t('common.field.name'),
    align: 'left',
    field: 'name',
    name: 'name',
    sortable: true
  },
  {
    label: t('admin.users.email'),
    align: 'left',
    field: 'email',
    name: 'email',
    sortable: false
  },
  {
    align: 'left',
    field: 'createdAt',
    name: 'date',
    sortable: false
  },
  {
    label: '',
    align: 'right',
    field: 'edit',
    name: 'edit',
    sortable: false,
    style: 'width: 250px'
  }
]

const permissions = [
  {
    permission: 'access:admin',
    hint: 'Can access the administration area.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:users',
    hint: 'Can create / manage users (but not users with administrative permissions)',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:groups',
    hint: 'Can create / manage groups and assign permissions (but not manage:system) / page rules',
    warning: true,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:navigation',
    hint: 'Can manage site navigation',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:theme',
    hint: 'Can modify site theme settings',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:sites',
    hint: 'Can create / manage sites',
    warning: true,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:system',
    hint: 'Can manage and access everything. Root administrator.',
    warning: true,
    restrictedForSystem: true,
    disabled: true
  }
]

/**
 * The subset of `rules` below that the guests group may be granted. Mirrors `GUEST_ROLES` in
 * `models/groups.ts`, which is the copy that decides — this one only shapes what is offered.
 */
const GUEST_ROLES = [
  'read:pages',
  'read:source',
  'read:history',
  'read:assets',
  'read:comments',
  'write:comments'
]

const rules = [
  {
    permission: 'read:pages',
    title: 'Read Pages',
    hint: 'Can view and search pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'write:pages',
    title: 'Write Pages',
    hint: 'Can create and edit pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'review:pages',
    title: 'Review Pages',
    hint: 'Can review and approve edits submitted by users.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:pages',
    title: 'Manage Pages',
    hint: 'Can move existing pages to other locations the user has write access to.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'delete:pages',
    title: 'Delete Pages',
    hint: 'Can delete existing pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'write:styles',
    title: 'Use CSS',
    hint: 'Can insert CSS styles in pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'write:scripts',
    title: 'Use JavaScript',
    hint: 'Can insert JavaScript in pages.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'read:source',
    title: 'View Page Source',
    hint: 'Can view pages source.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'read:history',
    title: 'View Page History',
    hint: 'Can view previous versions of pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'read:assets',
    title: 'View Assets',
    hint: 'Can view / use assets (such as images and files) in pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'write:assets',
    title: 'Upload Assets',
    hint: 'Can upload new assets (such as images and files).',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'manage:assets',
    title: 'Manage Assets',
    hint: 'Can edit and delete existing assets (such as images and files).',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  },
  {
    permission: 'read:comments',
    title: 'Read Comments',
    hint: 'Can view page comments.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'write:comments',
    title: 'Write Comments',
    hint: 'Can post new comments on pages.',
    warning: false,
    restrictedForSystem: false,
    disabled: false
  },
  {
    permission: 'manage:comments',
    title: 'Manage Comments',
    hint: 'Can edit and delete existing page comments.',
    warning: false,
    restrictedForSystem: true,
    disabled: false
  }
]

// VALIDATION RULES

const groupNameValidation = [(val) => /^[^<>"]+$/.test(val) || t('admin.groups.nameInvalidChars')]

// COMPUTED

const usersTotalPages = computed(() => {
  if (state.usersTotal < 1) {
    return 0
  }
  return Math.ceil(state.usersTotal / state.usersPageSize)
})

const isGuestGroup = computed(() => {
  return adminStore.overlayOpts.id === '10000000-0000-4000-8000-000000000001'
})

/**
 * The permissions a rule may grant, which for the guests group is a short list.
 *
 * That group is every anonymous reader at once, so a rule on it is a rule about the open internet:
 * reading, and saying something in a comment, are what the public may be given — writing a page or
 * deleting one is an action attributable to somebody, and there is nobody here.
 *
 * Only what is OFFERED. The set is enforced in `models/groups.ts`, which is what makes it true for a
 * group edited through the API as well; this keeps the screen from offering what would be dropped.
 */
const ruleOptions = computed(() =>
  isGuestGroup.value ? rules.filter((rule) => GUEST_ROLES.includes(rule.permission)) : rules
)

// WATCHERS

watch(() => route.params.section, checkRoute)
watch([() => state.usersPage, () => state.usersFilter], refreshUsers)

// METHODS

function close() {
  adminStore.$patch({ overlay: '' })
}

function checkRoute() {
  if (!route.params.section) {
    router.replace({ params: { section: 'overview' } })
  } else if (route.params.section === 'users') {
    refreshUsers()
  }
}

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

function getRuleModeColor(mode) {
  return {
    DENY: 'text-negative',
    ALLOW: 'text-positive',
    FORCEALLOW: 'text-blue'
  }[mode]
}

function getRuleModeBgColor(mode) {
  return {
    DENY: 'negative',
    ALLOW: 'positive',
    FORCEALLOW: 'blue'
  }[mode]
}

function getRuleModeClass(mode) {
  return 'is-' + mode.toLowerCase()
}

function getRuleModeIcon(mode) {
  return (
    {
      DENY: 'la:ban',
      ALLOW: 'la:check',
      FORCEALLOW: 'la:check-double'
    }[mode] || 'la:frog'
  )
}

function getNextRuleMode(mode) {
  return (
    {
      DENY: 'FORCEALLOW',
      ALLOW: 'DENY',
      FORCEALLOW: 'ALLOW'
    }[mode] || 'ALLOW'
  )
}

function getRuleModeName(mode) {
  switch (mode) {
    case 'ALLOW':
      return t('admin.groups.ruleAllow')
    case 'DENY':
      return t('admin.groups.ruleDeny')
    case 'FORCEALLOW':
      return t('admin.groups.ruleForceAllow')
    default:
      return '???'
  }
}

function refresh() {
  fetchGroup()
}

async function fetchGroup() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.get(`groups/${adminStore.overlayOpts.id}`).json()
    if (!resp?.id) {
      throw new Error('An unexpected error occured while fetching group details.')
    }
    state.group = resp
    state.usersTotal = state.group.userCount ?? 0
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}

async function save() {
  state.isLoading = true
  try {
    const resp = await API_CLIENT.put(`groups/${state.group.id}`, {
      json: {
        name: state.group.name,
        redirectOnLogin: state.group.redirectOnLogin ?? '',
        redirectOnFirstLogin: state.group.redirectOnFirstLogin ?? '',
        redirectOnLogout: state.group.redirectOnLogout ?? '',
        permissions: state.group.permissions ?? [],
        rules: state.group.rules ?? []
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.groups.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.groups.saveSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}

function newRule() {
  state.group.rules.push({
    id: uuid(),
    name: t('admin.groups.ruleUntitled'),
    mode: 'ALLOW',
    match: 'START',
    roles: [],
    path: '',
    locales: [],
    sites: []
  })
}

function deleteRule(id) {
  state.group.rules = state.group.rules.filter((r) => r.id !== id)
}

function exportRules() {
  if (state.group.rules.length < 1) {
    return notify({
      type: 'negative',
      message: t('admin.groups.exportRulesNoneError')
    })
  }
  const rules = state.group.rules.map(({ __typename, ...r }) => r)
  fileSave(new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json;charset=UTF-8' }), {
    fileName: 'rules.json',
    extensions: ['.json']
  })
}

async function importRules() {
  try {
    const blob = await fileOpen({
      mimeTypes: ['application/json'],
      extensions: ['.json'],
      startIn: 'downloads',
      excludeAcceptAllOption: true
    })
    const rulesRaw = await blob.text()
    const rules = JSON.parse(rulesRaw)
    if (!Array.isArray(rules) || rules.length < 1) {
      throw new Error('Invalid Rules Format')
    }
    confirm({
      title: t('admin.groups.importModeTitle'),
      message: t('admin.groups.importModeText'),
      options: {
        model: 'replace',
        type: 'radio',
        items: [
          { label: t('admin.groups.importModeReplace'), value: 'replace' },
          { label: t('admin.groups.importModeAdd'), value: 'add' }
        ]
      },
      persistent: true
    }).onOk((choice) => {
      if (choice === 'replace') {
        state.group.rules = []
      }
      state.group.rules = [
        ...state.group.rules,
        ...rules.map((r) => ({
          id: uuid(),
          name: r.name || t('admin.groups.ruleUntitled'),
          mode: ['ALLOW', 'DENY', 'FORCEALLOW'].includes(r.mode) ? r.mode : 'DENY',
          match: ['START', 'END', 'REGEX', 'TAG', 'TAGALL', 'EXACT'].includes(r.match)
            ? r.match
            : 'START',
          roles: r.roles || [],
          path: r.path || '',
          locales: r.locales.filter((l) => adminStore.locales.some((loc) => loc.code === l)),
          sites: r.sites.filter((s) => adminStore.sites.some((site) => site.id === s))
        }))
      ]
      notify({
        type: 'positive',
        message: t('admin.groups.importSuccess')
      })
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.groups.importFailed') + ` [${err.message}]`
    })
  }
}

async function refreshUsers() {
  state.isLoadingUsers = true
  try {
    const resp = await API_CLIENT.get(`groups/${adminStore.overlayOpts.id}/users`, {
      searchParams: {
        ...(state.usersFilter ? { filter: state.usersFilter } : {}),
        page: state.usersPage,
        limit: state.usersPageSize
      }
    }).json()
    if (!Array.isArray(resp?.users)) {
      throw new Error('An unexpected error occured while fetching group users.')
    }
    state.usersTotal = resp.total ?? 0
    state.users = resp.users
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoadingUsers = false
}

function assignUser() {
  dialog({
    component: UserSearchDialog,
    componentProps: {
      title: t('admin.groups.assignUserTitle'),
      // -> Only offer users the API would actually accept: not already members, not system users
      assignableToGroupId: state.group.id
    }
  }).onOk(async (users) => {
    state.isLoadingUsers = true
    // -> Assignment is one user per request, so a failure partway through still leaves the
    //    successful ones assigned; report both sides rather than a single all-or-nothing message.
    let assigned = 0
    for (const usr of users) {
      try {
        const resp = await API_CLIENT.post(`groups/${state.group.id}/users/${usr.id}`).json()
        if (!resp?.ok) {
          throw new Error(resp?.message || 'An unexpected error occured.')
        }
        assigned++
      } catch (err) {
        // -> ky throws above 400, with the reason in the body
        const apiMessage = await err.response
          ?.json()
          .then((b) => b?.message)
          .catch(() => null)
        notify({
          type: 'negative',
          message: t('admin.groups.assignUserFailed', { userName: usr.name }),
          caption: apiMessage || err.message
        })
      }
    }
    if (assigned > 0) {
      notify({
        type: 'positive',
        message: t('admin.groups.assignUserSuccess', { count: assigned })
      })
    }
    await refreshUsers()
  })
}

async function unassignUser(user) {
  confirm({
    title: t('admin.groups.unassignUser'),
    message: t('admin.groups.unassignUserConfirm', { userName: user.name }),
    cancel: true,
    persistent: true
  }).onOk(async () => {
    state.isLoadingUsers = true
    try {
      const resp = await API_CLIENT.delete(`groups/${state.group.id}/users/${user.id}`)
      if (!resp?.ok) {
        throw new Error((await resp.json())?.message || 'An unexpected error occured.')
      }
      notify({
        type: 'positive',
        message: t('admin.groups.unassignUserSuccess')
      })
      await refreshUsers()
    } catch (err) {
      // -> ky throws above 400 (e.g. 409 for the last root admin), with the reason in the body
      const apiMessage = await err.response
        ?.json()
        .then((b) => b?.message)
        .catch(() => null)
      notify({
        type: 'negative',
        message: apiMessage || err.message
      })
    }
    state.isLoadingUsers = false
  })
}

// MOUNTED

onMounted(() => {
  checkRoute()
  fetchGroup()
})
</script>

<style lang="scss">
.admin-groups-rule {
  position: relative;
  padding: 10px 0 24px 40px;

  &-icon {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    width: 31px;

    &::before {
      position: absolute;
      content: '';
      border-radius: 100%;
      width: 31px;
      height: 31px;
      background-color: currentColor;
      top: 4px;
    }

    &::after {
      position: absolute;
      content: '';
      width: 3px;
      top: 41px;
      bottom: 0;
      left: 14px;
      opacity: 0.4;
      background-color: currentColor;
      display: block;
    }

    /*
      Sized and placed to the disc `::before` draws, with the glyph inset by the padding: an inline
      <svg> scales its viewBox to whatever box it is given, so the old `width: 100%; height: 38px`
      -- metrics for the icon FONT this replaced, where `font-size` did the sizing -- stretched the
      mark across the whole circle.

      The box stays the full 31px even though the glyph is 15px, so the click target is the disc a
      reader is aiming at rather than the mark inside it.
    */
    .w-icon {
      position: absolute;
      top: 4px;
      left: 0;
      box-sizing: border-box;
      width: 31px;
      height: 31px;
      padding: 8px;
      cursor: pointer;
    }
  }

  &-name {
    line-height: 12px;
    display: flex;
    flex-wrap: nowrap;
    /*
      On the text baseline, not stretched. An <input> stretched to the row's height centres its text
      inside that height, while the mode name beside it sits at the top of its own box -- so the two
      read as a few pixels apart even though both are 12px type. The separator between them is
      unaffected: it carries its own `self-stretch`, which outranks this.
    */
    align-items: baseline;
    padding-top: 4px;

    &-text {
      flex: 0 0;
      white-space: nowrap;
    }

    input {
      font-weight: 700;
      color: $grey-6;
      letter-spacing: 1px;
      font-size: 12px;
      line-height: 12px;
      border: none;
      padding: 0 0 0 5px;
      outline: none;
      flex: 1;
      background-color: transparent;

      &::placeholder {
        color: $grey-5;
      }

      @at-root .body--dark & {
        color: rgba(255, 255, 255, 0.7);

        &::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      }
    }
  }

  &-card {
    background-color: $grey-2 !important;

    @at-root .body--dark & {
      background-color: $dark-6 !important;
    }

    &-permissions {
      background-color: rgba($positive, 0.1);
      border-bottom: 1px solid rgba($positive, 0.3);
      display: flex;
      align-items: center;

      .w-select {
        flex-basis: 100%;
      }

      &.is-allow {
        background-color: rgba($positive, 0.1);
        border-bottom: 1px solid rgba($positive, 0.3);
      }
      &.is-deny {
        background-color: rgba($negative, 0.1);
        border-bottom: 1px solid rgba($negative, 0.3);
      }
      &.is-forceallow {
        background-color: rgba($blue, 0.1);
        border-bottom: 1px solid rgba($blue, 0.3);
      }
    }

    &-filters {
      background-color: $grey-3;
      flex-basis: 300px;

      .text-caption:first-child {
        color: $grey-7;
      }

      @at-root .body--dark & {
        background-color: $dark-5;
      }
    }
    &-pattern {
      flex-grow: 1;
    }
  }
}
</style>
