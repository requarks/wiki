<template>
  <w-layout view="hHh lpR fFf" container>
    <w-header class="card-header px-4 py-2">
      <w-icon name="img:/_assets/icons/fluent-account.svg" left size="md" />
      <div>
        <span>{{ t(`admin.users.edit`) }}</span>
        <div class="text-caption">{{ state.user.name }}</div>
      </div>
      <w-space />
      <w-btn-group push>
        <w-btn
          push
          color="grey-6"
          text-color="white"
          :aria-label="t(`common.actions.refresh`)"
          icon="la:redo-alt"
          @click="fetchUser"
          :loading="state.loading > 0">
          <w-tooltip anchor="center left" self="center right">{{
            t(`common.actions.refresh`)
          }}</w-tooltip>
        </w-btn>
        <w-btn
          push
          color="white"
          text-color="grey-7"
          :label="t(`common.actions.close`)"
          :aria-label="t(`common.actions.close`)"
          icon="la:times"
          @click="close" />
        <w-btn
          push
          color="positive"
          text-color="white"
          :label="t(`common.actions.save`)"
          :aria-label="t(`common.actions.save`)"
          icon="la:check"
          @click="save()"
          :disabled="state.loading > 0" />
      </w-btn-group>
    </w-header>
    <w-drawer class="bg-dark-6" :model-value="true" :width="250" dark>
      <w-list padding dark v-if="state.loading < 1">
        <template v-for="sc of sections" :key="`section-` + sc.key">
          <w-item
            v-if="!sc.disabled || flagsStore.experimental"
            clickable
            :to="{ params: { section: sc.key } }"
            active-class="bg-primary text-white"
            :disabled="sc.disabled">
            <w-item-section side><w-icon :name="sc.icon" color="white" /></w-item-section>
            <w-item-section>{{ sc.text }}</w-item-section>
          </w-item>
        </template>
      </w-list>
    </w-drawer>
    <w-page-container>
      <w-page v-if="state.loading > 0">
        <div class="flex p-6 items-center">
          <w-spinner color="primary" size="32px" />
          <div class="text-caption text-primary pl-4">
            <strong>{{ t('admin.users.loading') }}</strong>
          </div>
        </div>
      </w-page>
      <w-page v-else-if="route.params.section === `overview`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.users.profile') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="contact" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.name`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.nameHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.user.name"
                      dense
                      :rules="[
                        (val) => invalidCharsRegex.test(val) || t('admin.users.nameInvalidChars')
                      ]"
                      hide-bottom-space
                      :aria-label="t(`admin.users.name`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="envelope" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.email`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.emailHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-input
                      outlined
                      v-model="state.user.email"
                      dense
                      :aria-label="t(`admin.users.email`)" />
                  </w-item-section>
                </w-item>
                <template v-if="state.user.meta">
                  <w-separator class="my-2" inset />
                  <w-item>
                    <blueprint-icon icon="address" />
                    <w-item-section>
                      <w-item-label>{{ t(`admin.users.location`) }}</w-item-label>
                      <w-item-label caption>{{ t(`admin.users.locationHint`) }}</w-item-label>
                    </w-item-section>
                    <w-item-section>
                      <w-input
                        outlined
                        v-model="state.user.meta.location"
                        dense
                        :aria-label="t(`admin.users.location`)" />
                    </w-item-section>
                  </w-item>
                  <w-separator class="my-2" inset />
                  <w-item>
                    <blueprint-icon icon="new-job" />
                    <w-item-section>
                      <w-item-label>{{ t(`admin.users.jobTitle`) }}</w-item-label>
                      <w-item-label caption>{{ t(`admin.users.jobTitleHint`) }}</w-item-label>
                    </w-item-section>
                    <w-item-section>
                      <w-input
                        outlined
                        v-model="state.user.meta.jobTitle"
                        dense
                        :aria-label="t(`admin.users.jobTitle`)" />
                    </w-item-section>
                  </w-item>
                  <w-separator class="my-2" inset />
                  <w-item>
                    <blueprint-icon icon="gender" />
                    <w-item-section>
                      <w-item-label>{{ t(`admin.users.pronouns`) }}</w-item-label>
                      <w-item-label caption>{{ t(`admin.users.pronounsHint`) }}</w-item-label>
                    </w-item-section>
                    <w-item-section>
                      <w-input
                        outlined
                        v-model="state.user.meta.pronouns"
                        dense
                        :aria-label="t(`admin.users.pronouns`)" />
                    </w-item-section>
                  </w-item>
                </template>
              </w-card>
              <w-card class="shadow-1 pb-2 mt-4" v-if="state.user.meta">
                <w-card-header>{{ t('admin.users.preferences') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="timezone" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.timezone`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.timezoneHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-select
                      outlined
                      v-model="state.user.prefs.timezone"
                      :options="timezones"
                      option-value="value"
                      option-label="text"
                      emit-value
                      map-options
                      dense
                      options-dense
                      :aria-label="t(`admin.users.timezone`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="calendar" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.dateFormat`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.dateFormatHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section>
                    <w-select
                      outlined
                      v-model="state.user.prefs.dateFormat"
                      emit-value
                      map-options
                      dense
                      :aria-label="t(`admin.users.dateFormat`)"
                      :options="[
                        { label: t('profile.localeDefault'), value: '' },
                        { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
                        { label: 'DD.MM.YYYY', value: 'DD.MM.YYYY' },
                        { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
                        { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
                        { label: 'YYYY/MM/DD', value: 'YYYY/MM/DD' }
                      ]" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="clock" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.timeFormat`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.timeFormatHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section class="flex-none">
                    <w-btn-toggle
                      v-model="state.user.prefs.timeFormat"
                      push
                      glossy
                      no-caps
                      toggle-color="primary"
                      :options="[
                        { label: t('profile.timeFormat12h'), value: '12h' },
                        { label: t('profile.timeFormat24h'), value: '24h' }
                      ]" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="light-on" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.appearance`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.darkModeHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section class="flex-none">
                    <w-btn-toggle
                      v-model="state.user.prefs.appearance"
                      push
                      glossy
                      no-caps
                      toggle-color="primary"
                      :options="[
                        { label: t('profile.appearanceDefault'), value: 'site' },
                        { label: t('profile.appearanceLight'), value: 'light' },
                        { label: t('profile.appearanceDark'), value: 'dark' }
                      ]" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="visualy-impaired" />
                  <w-item-section>
                    <w-item-label>{{ t(`profile.cvd`) }}</w-item-label>
                    <w-item-label caption>{{ t(`profile.cvdHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section class="flex-none">
                    <w-btn-toggle
                      v-model="state.user.prefs.cvd"
                      push
                      glossy
                      no-caps
                      toggle-color="primary"
                      :options="[
                        { value: 'none', label: t('profile.cvdNone') },
                        { value: 'protanopia', label: t('profile.cvdProtanopia') },
                        { value: 'deuteranopia', label: t('profile.cvdDeuteranopia') },
                        { value: 'tritanopia', label: t('profile.cvdTritanopia') }
                      ]" />
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
            <div class="col-span-12 lg:col-span-4">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.users.info') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="person" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`common.field.id`) }}</w-item-label>
                    <w-item-label
                      ><strong>{{ state.user.id }}</strong></w-item-label
                    >
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="calendar-plus" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`common.field.createdOn`) }}</w-item-label>
                    <w-item-label>
                      <strong>{{ formattedDate(state.user.createdAt) }}</strong>
                    </w-item-label>
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="summertime" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`common.field.lastUpdated`) }}</w-item-label>
                    <w-item-label>
                      <strong>{{ formattedDate(state.user.updatedAt) }}</strong>
                    </w-item-label>
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="enter" :hue-rotate="-45" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.lastLoginAt`) }}</w-item-label>
                    <w-item-label>
                      <strong>{{ formattedDate(state.user.lastLoginAt) }}</strong>
                    </w-item-label>
                  </w-item-section>
                </w-item>
              </w-card>
              <w-card class="shadow-1 pb-2 mt-4" v-if="state.user.meta">
                <w-card-header>{{ t('admin.users.notes') }}</w-card-header>
                <w-card-section class="pt-0">
                  <w-input
                    outlined
                    v-model="state.user.meta.notes"
                    type="textarea"
                    :aria-label="t(`admin.users.notes`)"
                    input-style="min-height: 243px"
                    :hint="t(`admin.users.noteHint`)" />
                </w-card-section>
              </w-card>
            </div>
          </div>
        </div>
      </w-page>
      <w-page v-else-if="route.params.section === `activity`"><span>---</span></w-page>
      <w-page v-else-if="route.params.section === `auth`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-7">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.users.passAuth') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="password" :hue-rotate="45" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.changePassword`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.changePasswordHint`) }}</w-item-label>
                    <w-item-label caption>
                      <strong
                        :class="localAuth.isPasswordSet ? `text-positive` : `text-negative`"
                        >{{
                          localAuth.isPasswordSet
                            ? t(`admin.users.pwdSet`)
                            : t(`admin.users.pwdNotSet`)
                        }}</strong
                      >
                    </w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="primary"
                      @click="changePassword"
                      :label="t(`common.actions.proceed`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item tag="label">
                  <blueprint-icon icon="password-reset" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.mustChangePwd`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.mustChangePwdHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="localAuth.mustChangePwd"
                      color="primary"
                      checked-icon="la:check"
                      unchecked-icon="la:times"
                      :aria-label="t(`admin.users.mustChangePwd`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item tag="label">
                  <blueprint-icon icon="key" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.pwdAuthRestrict`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.pwdAuthRestrictHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="localAuth.restrictLogin"
                      color="primary"
                      checked-icon="la:check"
                      unchecked-icon="la:times"
                      :aria-label="t(`admin.users.pwdAuthRestrict`)" />
                  </w-item-section>
                </w-item>
              </w-card>
              <w-card class="shadow-1 pb-2 mt-4">
                <w-card-header>{{ t('admin.users.tfa') }}</w-card-header>
                <w-item tag="label">
                  <blueprint-icon icon="key" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.tfaRequired`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.tfaRequiredHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section avatar>
                    <w-toggle
                      v-model="localAuth.isTfaRequired"
                      color="primary"
                      checked-icon="la:check"
                      unchecked-icon="la:times"
                      :aria-label="t(`admin.users.tfaRequired`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="password" :hue-rotate="45" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.tfaInvalidate`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.tfaInvalidateHint`) }}</w-item-label>
                    <w-item-label caption>
                      <strong :class="localAuth.isTfaSetup ? `text-positive` : `text-negative`">{{
                        localAuth.isTfaSetup ? t(`admin.users.tfaSet`) : t(`admin.users.tfaNotSet`)
                      }}</strong>
                    </w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="primary"
                      @click="invalidateTFA"
                      :label="t(`common.actions.proceed`)" />
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
            <div class="col-span-12 lg:col-span-5">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.users.linkedProviders') }}</w-card-header>
                <w-card-section v-if="linkedAuthProviders.length < 1" class="pt-0">
                  <w-banner
                    rounded
                    :class="dark.isActive ? `bg-negative text-white` : `bg-grey-2 text-grey-7`"
                    >{{ t('admin.users.noLinkedProviders') }}</w-banner
                  >
                </w-card-section>
                <template v-for="(prv, idx) in linkedAuthProviders" :key="prv.authId">
                  <w-separator class="my-2" inset v-if="idx > 0" />
                  <w-item>
                    <blueprint-icon :icon="prv.strategyIcon" :hue-rotate="-45" />
                    <w-item-section>
                      <w-item-label>{{ prv.authName }}</w-item-label>
                      <w-item-label caption>{{ prv.config.key }}</w-item-label>
                    </w-item-section>
                  </w-item>
                </template>
              </w-card>
            </div>
          </div>
        </div>
      </w-page>
      <w-page v-else-if="route.params.section === `groups`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.users.groups') }}</w-card-header>
                <template v-for="(grp, idx) of state.user.groups" :key="grp.id">
                  <w-separator class="my-2" inset v-if="idx > 0" />
                  <w-item>
                    <blueprint-icon icon="team" :hue-rotate="-45" />
                    <w-item-section
                      ><w-item-label>{{ grp.name }}</w-item-label></w-item-section
                    >
                    <w-item-section side>
                      <w-btn
                        class="acrylic-btn"
                        flat
                        icon="la:times"
                        color="accent"
                        @click="unassignGroup(grp.id)"
                        :aria-label="t(`admin.users.unassignGroup`)">
                        <w-tooltip anchor="center left" self="center right">{{
                          t('admin.users.unassignGroup')
                        }}</w-tooltip>
                      </w-btn>
                    </w-item-section>
                  </w-item>
                </template>
              </w-card>
              <w-card class="shadow-1 py-2 mt-4">
                <w-item>
                  <blueprint-icon icon="join" />
                  <w-item-section>
                    <w-select
                      outlined
                      :options="state.groups"
                      v-model="state.groupToAdd"
                      map-options
                      emit-value
                      option-value="id"
                      option-label="name"
                      options-dense
                      dense
                      hide-bottom-space
                      :label="t(`admin.users.groups`)"
                      :aria-label="t(`admin.users.groups`)"
                      :loading="state.loading > 0" />
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      unelevated
                      icon="la:plus"
                      :label="t(`admin.users.assignGroup`)"
                      color="primary"
                      @click="assignGroup" />
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
          </div>
        </div>
      </w-page>
      <w-page v-else-if="route.params.section === `metadata`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
              <w-card class="shadow-1 pb-2">
                <w-card-header>
                  {{ t('admin.users.metadata') }}
                  <template #action>
                    <w-badge v-if="state.metadataInvalidJSON" color="negative">
                      <w-icon class="mr-1" name="la:exclamation-triangle" size="20px" />
                      <span>{{ t('admin.users.invalidJSON') }}</span>
                    </w-badge>
                    <w-badge class="py-1" v-else label="JSON" color="positive" />
                  </template>
                </w-card-header>
                <w-item>
                  <w-item-section>
                    <util-code-editor
                      v-model="metadata"
                      language="json"
                      :min-height="500"
                      aria-label="Metadata (JSON)" />
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
          </div>
        </div>
      </w-page>
      <w-page v-else-if="route.params.section === `operations`">
        <div class="p-4">
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12 lg:col-span-8">
              <w-card class="shadow-1 pb-2">
                <w-card-header>{{ t('admin.users.operations') }}</w-card-header>
                <w-item>
                  <blueprint-icon icon="email-open" :hue-rotate="45" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.sendWelcomeEmail`) }}</w-item-label>
                    <w-item-label caption>{{
                      t(`admin.users.sendWelcomeEmailAltHint`)
                    }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="primary"
                      @click="sendWelcomeEmail"
                      :label="t(`common.actions.proceed`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="apply" :hue-rotate="45" />
                  <w-item-section>
                    <w-item-label>{{
                      state.user.isVerified ? t(`admin.users.unverify`) : t(`admin.users.verify`)
                    }}</w-item-label>
                    <w-item-label caption>{{
                      state.user.isVerified
                        ? t(`admin.users.unverifyHint`)
                        : t(`admin.users.verifyHint`)
                    }}</w-item-label>
                    <w-item-label caption>
                      <strong :class="state.user.isVerified ? `text-positive` : `text-negative`">{{
                        state.user.isVerified
                          ? t(`admin.users.verified`)
                          : t(`admin.users.unverified`)
                      }}</strong>
                    </w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="primary"
                      @click="toggleVerified"
                      :label="t(`common.actions.proceed`)" />
                  </w-item-section>
                </w-item>
                <w-separator class="my-2" inset />
                <w-item>
                  <blueprint-icon icon="unfriend" :hue-rotate="45" />
                  <w-item-section>
                    <w-item-label>{{
                      state.user.isActive ? t(`admin.users.ban`) : t(`admin.users.unban`)
                    }}</w-item-label>
                    <w-item-label caption>{{
                      state.user.isActive ? t(`admin.users.banHint`) : t(`admin.users.unbanHint`)
                    }}</w-item-label>
                    <w-item-label caption>
                      <strong :class="state.user.isActive ? `text-positive` : `text-negative`">{{
                        state.user.isActive ? t(`admin.users.active`) : t(`admin.users.banned`)
                      }}</strong>
                    </w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="primary"
                      @click="toggleBan"
                      :label="t(`common.actions.proceed`)" />
                  </w-item-section>
                </w-item>
              </w-card>
              <w-card class="shadow-1 py-2 mt-4">
                <w-item>
                  <blueprint-icon icon="denied" :hue-rotate="140" />
                  <w-item-section>
                    <w-item-label>{{ t(`admin.users.delete`) }}</w-item-label>
                    <w-item-label caption>{{ t(`admin.users.deleteHint`) }}</w-item-label>
                  </w-item-section>
                  <w-item-section side>
                    <w-btn
                      class="acrylic-btn"
                      flat
                      icon="la:arrow-circle-right"
                      color="negative"
                      @click="deleteUser"
                      :label="t(`common.actions.proceed`)" />
                  </w-item-section>
                </w-item>
              </w-card>
            </div>
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
import { loading } from '@/composables/loading'
import { useDark } from '@/composables/dark'
import { notify } from '@/composables/notify'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useUserStore } from '@/stores/user'

import UserChangePwdDialog from './UserChangePwdDialog.vue'
import UtilCodeEditor from './UtilCodeEditor.vue'

// COMPOSABLES

const dark = useDark()

// STORES

const adminStore = useAdminStore()
const flagsStore = useFlagsStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  invalidCharsRegex: /^[^<>"]+$/,
  user: {
    meta: {},
    prefs: {},
    groups: []
  },
  groups: [],
  groupToAdd: null,
  loading: 0,
  metadataInvalidJSON: false
})

const sections = [
  { key: 'overview', text: t('admin.users.overview'), icon: 'la:user' },
  { key: 'activity', text: t('admin.users.activity'), icon: 'la:chart-area', disabled: true },
  { key: 'auth', text: t('admin.users.auth'), icon: 'la:key' },
  { key: 'groups', text: t('admin.users.groups'), icon: 'la:users' },
  { key: 'metadata', text: t('admin.users.metadata'), icon: 'la:clipboard-list' },
  { key: 'operations', text: t('admin.users.operations'), icon: 'la:tools' }
]

const timezones = Intl.supportedValuesOf('timeZone')

// COMPUTED

const metadata = computed({
  get() {
    return JSON.stringify(state.user.meta ?? {}, null, 2)
  },
  set(val) {
    try {
      state.user.meta = JSON.parse(val)
      state.metadataInvalidJSON = false
    } catch (err) {
      state.metadataInvalidJSON = true
    }
  }
})

const localAuth = computed({
  get() {
    return state.user?.auth?.find((prv) => prv.strategyKey === 'local')?.config ?? {}
  },
  set(val) {
    if (localAuth.value.authId) {
      state.user.auth.find((prv) => prv.strategyKey === 'local').config = val
    }
  }
})

const linkedAuthProviders = computed(() => {
  if (!state.user?.auth) {
    return []
  }

  return state.user.auth.filter((prv) => prv.strategyKey !== 'local')
})

// WATCHERS

watch(() => route.params.section, checkRoute)

// METHODS

async function fetchUser() {
  state.loading++
  loading.show()
  try {
    const [groups, user] = await Promise.all([
      API_CLIENT.get('groups').json(),
      API_CLIENT.get(`users/${adminStore.overlayOpts.id}`).json()
    ])
    state.groups = (groups ?? []).filter((g) => g.id !== '10000000-0000-4000-8000-000000000001')
    if (!user?.id) {
      throw new Error('An unexpected error occured while fetching user details.')
    }
    state.user = user
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  loading.hide()
  state.loading--
}

function close() {
  adminStore.$patch({ overlay: '' })
}

function checkRoute() {
  if (!route.params.section) {
    router.replace({ params: { section: 'overview' } })
  }
  if (route.params.section === 'metadata') {
    state.metadataInvalidJSON = false
  }
}

function formattedDate(val) {
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

function assignGroup() {
  if (!state.groupToAdd) {
    notify({
      type: 'negative',
      message: t('admin.users.noGroupSelected')
    })
  } else if (state.user.groups.some((gr) => gr.id === state.groupToAdd)) {
    notify({
      type: 'warning',
      message: t('admin.users.groupAlreadyAssigned')
    })
  } else {
    const newGroup = state.groups.find((gr) => gr.id === state.groupToAdd)
    state.user.groups = [...state.user.groups, newGroup]
  }
}

function unassignGroup(id) {
  if (state.user.groups.length <= 1) {
    notify({
      type: 'negative',
      message: t('admin.users.minimumGroupRequired')
    })
  } else {
    state.user.groups = state.user.groups.filter((gr) => gr.id === id)
  }
}

async function save(patch, { silent, keepOpen } = { silent: false, keepOpen: false }) {
  loading.show()
  if (!patch) {
    patch = {
      name: state.user.name,
      email: state.user.email,
      isVerified: state.user.isVerified,
      isActive: state.user.isActive,
      meta: state.user.meta,
      prefs: state.user.prefs,
      groups: state.user.groups.map((gr) => gr.id),
      auth: {
        tfaRequired: localAuth.value.isTfaRequired,
        mustChangePwd: localAuth.value.mustChangePwd,
        restrictLogin: localAuth.value.restrictLogin
      }
    }
  }
  try {
    const resp = await API_CLIENT.put(`users/${adminStore.overlayOpts.id}`, {
      json: patch
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.users.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    if (!silent) {
      notify({
        type: 'positive',
        message: t('admin.users.saveSuccess')
      })
    }
    if (!keepOpen) {
      close()
    }
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  loading.hide()
}

function changePassword() {
  dialog({
    component: UserChangePwdDialog,
    componentProps: {
      userId: adminStore.overlayOpts.id
    }
  }).onOk(({ mustChangePassword }) => {
    localAuth.value = {
      ...localAuth.value,
      mustChangePwd: mustChangePassword
    }
  })
}

function invalidateTFA() {
  confirm({
    title: t('admin.users.tfaInvalidate'),
    message: t('admin.users.tfaInvalidateConfirm'),
    cancel: true,
    persistent: true,
    okLabel: t('common.actions.confirm')
  }).onOk(() => {
    // TODO: invalidate user 2FA
    notify({
      type: 'positive',
      message: t('admin.users.tfaInvalidateSuccess')
    })
  })
}

async function sendWelcomeEmail() {}

function toggleVerified() {
  state.user.isVerified = !state.user.isVerified
  save(
    {
      isVerified: state.user.isVerified
    },
    { silent: true, keepOpen: true }
  )
}

function toggleBan() {
  state.user.isActive = !state.user.isActive
  save(
    {
      isActive: state.user.isActive
    },
    { silent: true, keepOpen: true }
  )
}

async function deleteUser() {}

// MOUNTED

onMounted(() => {
  checkRoute()
  fetchUser()
})
</script>

<!--
  -> The `.metadata-codemirror` rules that were here targeted `.cm-editor`, a CodeMirror 6 class this
     app never had, from a class no element in this file carries. Dead twice over.
-->
