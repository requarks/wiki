<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-male-user.svg', :alt='$t(`admin:users.edit`)', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft {{$t('admin:users.edit')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s {{user.name}}
          v-spacer
          template(v-if='user.isActive')
            status-indicator.mr-3(positive, pulse)
            .caption.green--text {{$t('admin:users.active')}}
          template(v-else)
            status-indicator.mr-3(negative, pulse)
            .caption.red--text {{$t('admin:users.inactive')}}
          template(v-if='user.isVerified')
            status-indicator.mr-3.ml-4(active, pulse)
            .caption.blue--text {{$t('admin:users.verified')}}
          template(v-else)
            status-indicator.mr-3.ml-4(intermediary, pulse)
            .caption.deep-orange--text {{$t('admin:users.unverified')}}
          v-spacer
          i18next.caption.grey--text.animated.fadeInRight.wait-p5s(path='admin:users.id', tag='div')
            strong(place='id') {{user.id}}
          v-divider.animated.fadeInRight.wait-p3s.ml-3(vertical)
          v-btn.ml-3.animated.fadeInDown.wait-p2s(color='grey', large, outlined, to='/users')
            v-icon mdi-arrow-left
          v-dialog(v-model='deleteUserDialog', max-width='500', v-if='user.id !== currentUserId && !user.isSystem')
            template(v-slot:activator='{ on }')
              v-btn.ml-3.animated.fadeInDown.wait-p1s(color='red', large, outlined, v-on='on', disabled)
                v-icon(color='red') mdi-trash-can-outline
            v-card
              .dialog-header.is-red Delete User?
              v-card-text Are you sure you want to delete user #[strong {{ user.name }}]?
              v-card-actions
                v-spacer
                v-btn(text, @click='deleteUserDialog = false') Cancel
                v-btn(color='red', dark, @click='deleteUser') Delete
          v-btn.ml-3.animated.fadeInDown(color='primary', large, depressed, @click='updateUser')
            v-icon(left) mdi-check
            span Update User
      v-flex(xs6)
        v-card.animated.fadeInUp
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-information-variant
            span {{$t('admin:users.basicInfo')}}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-email-variant
              v-list-item-content
                v-list-item-title {{$t('admin:users.email')}}
                v-list-item-subtitle {{ user.email }}
              v-list-item-action(v-if='!user.isSystem && user.providerKey === `local`')
                v-menu(
                  v-model='editPop.email'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptEmail`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptEmail'
                      v-model='user.email'
                      :label='$t(`admin:users.email`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.email = false'
                      @keydown.enter='editPop.email = false'
                      @keydown.esc='editPop.email = false'
                    )

            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account
              v-list-item-content
                v-list-item-title {{$t('admin:users.displayName')}}
                v-list-item-subtitle {{ user.name }}
              v-list-item-action
                v-menu(
                  v-model='editPop.name'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptDisplayName`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptDisplayName'
                      v-model='user.name'
                      :label='$t(`admin:users.displayName`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.name = false'
                      @keydown.enter='editPop.name = false'
                      @keydown.esc='editPop.name = false'
                    )

        v-card.mt-3.animated.fadeInUp.wait-p2s(v-if='!user.isSystem')
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-lock-outline
            span {{$t('admin:users.authentication')}}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-domain
              v-list-item-content
                v-list-item-title {{$t('admin:users.authProvider')}}
                v-list-item-subtitle {{ user.providerKey }}
              //- v-list-item-action
              //-   v-img(src='https://static.requarks.io/logo/wikijs.svg', alt='', contain, max-height='32', position='center right')
            template(v-if='user.providerKey === `local`')
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-textbox-password
                v-list-item-content
                  v-list-item-title {{$t('admin:users.password')}}
                  v-list-item-subtitle &bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;
                v-list-item-action
                  v-menu(
                    v-model='editPop.newPassword'
                    :close-on-content-click='false'
                    min-width='350'
                    left
                    )
                    template(v-slot:activator='{ on: menu }')
                      v-tooltip(top)
                        template(v-slot:activator='{ on: tooltip }')
                          v-btn(icon, color='grey', x-small, v-on='{ ...menu, ...tooltip }', @click='focusField(`iptNewPassword`)')
                            v-icon mdi-cached
                        span {{$t('admin:users.changePassword')}}
                    v-card
                      v-text-field(
                        ref='iptNewPassword'
                        v-model='newPassword'
                        :label='$t(`admin:users.newPassword`)'
                        solo
                        hide-details
                        append-icon='mdi-check'
                        type='password'
                        @click:append='editPop.newPassword = false'
                        @keydown.enter='editPop.newPassword = false'
                        @keydown.esc='editPop.newPassword = false'
                      )
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', x-small, v-on='on', disabled)
                        v-icon mdi-email
                    span Send Password Reset Email
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-two-factor-authentication
                v-list-item-content
                  v-list-item-title {{$t('admin:users.tfa')}}
                  v-list-item-subtitle.red--text Inactive
                v-list-item-action
                  v-tooltip(top)
                    template(v-slot:activator='{ on }')
                      v-btn(icon, color='grey', x-small, v-on='on', disabled)
                        v-icon mdi-power
                    span {{$t('admin:users.toggle2FA')}}
            template(v-if='user.providerId')
              v-divider
              v-list-item
                v-list-item-avatar(size='32')
                  v-icon mdi-music-accidental-sharp
                v-list-item-content
                  v-list-item-title {{$t('admin:users.authProviderId')}}
                  v-list-item-subtitle {{ user.providerId }}
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-group
            span {{$t('admin:users.groups')}}
          v-list(dense)
            template(v-for='(group, idx) in user.groups')
              v-list-item(:key='`group-` + group.id')
                v-list-item-avatar(size='32')
                  v-icon mdi-account-group-outline
                v-list-item-content
                  v-list-item-title {{group.name}}
                v-list-item-action(v-if='!user.isSystem')
                  v-btn(icon, color='red', x-small, @click='unassignGroup(group.id)')
                    v-icon mdi-close
              v-divider(v-if='idx < user.groups.length - 1')
          v-alert.mx-3(v-if='user.groups.length < 1', outlined, color='grey darken-1', icon='mdi-alert')
            .caption {{$t('admin:users.noGroupAssigned')}}
          v-card-chin(v-if='!user.isSystem')
            v-spacer
            v-select(
              ref='iptAssignGroup'
              :items='groups'
              v-model='newGroup'
              :label='$t(`admin:users.selectGroup`)'
              item-value='id'
              item-text='name'
              item-disabled='isSystem'
              solo
              flat
              dense
              hide-details
              @keydown.esc='editPop.assignGroup = false'
              style='max-width: 300px;'
            )
            v-btn.ml-2.px-4(depressed, color='primary', height='48', @click='assignGroup', :disabled='newGroup === 0')
              v-icon(left) mdi-clipboard-account-outline
              span {{$t('admin:users.groupAssign')}}
      v-flex(xs6)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-account-badge-outline
            span {{$t('admin:users.extendedMetadata')}}
          v-list.py-0(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-marker
              v-list-item-content
                v-list-item-title {{$t('admin:users.location')}}
                v-list-item-subtitle {{ user.location }}
              v-list-item-action
                v-menu(
                  v-model='editPop.location'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptLocation`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptLocation'
                      v-model='user.location'
                      :label='$t(`admin:users.location`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.location = false'
                      @keydown.enter='editPop.location = false'
                      @keydown.esc='editPop.location = false'
                    )
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account-badge-horizontal-outline
              v-list-item-content
                v-list-item-title {{$t('admin:users.jobTitle')}}
                v-list-item-subtitle {{ user.jobTitle }}
              v-list-item-action
                v-menu(
                  v-model='editPop.jobTitle'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptJobTitle`)')
                      v-icon mdi-pencil
                  v-card
                    v-text-field(
                      ref='iptJobTitle'
                      v-model='user.jobTitle'
                      :label='$t(`admin:users.jobTitle`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.jobTitle = false'
                      @keydown.enter='editPop.jobTitle = false'
                      @keydown.esc='editPop.jobTitle = false'
                    )
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-clock-outline
              v-list-item-content
                v-list-item-title {{$t('admin:users.timezone')}}
                v-list-item-subtitle {{ user.timezone }}
              v-list-item-action
                v-menu(
                  v-model='editPop.timezone'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(icon, color='grey', x-small, v-on='on', @click='focusField(`iptTimezone`)')
                      v-icon mdi-pencil
                  v-card
                    v-select(
                      ref='iptTimezone'
                      :items='timezones'
                      v-model='user.timezone'
                      :label='$t(`admin:users.timezone`)'
                      solo
                      dense
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.timezone = false'
                      @keydown.enter='editPop.timezone = false'
                      @keydown.esc='editPop.timezone = false'
                    )
        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, dark, flat)
            v-icon.mr-2 mdi-file-document-box-multiple-outline
            span Content
          v-card-text
            em.caption.grey--text Coming soon

</template>
<script>
import _ from 'lodash'
import { get } from 'vuex-pathify'

import { StatusIndicator } from 'vue-status-indicator'

import userQuery from 'gql/admin/users/users-query-single.gql'
import groupsQuery from 'gql/admin/users/users-query-groups.gql'
import updateUserMutation from 'gql/admin/users/users-mutation-update.gql'

export default {
  components: {
    StatusIndicator
  },
  data() {
    return {
      deleteUserDialog: false,
      editPop: {
        email: false,
        name: false,
        pwd: false,
        location: false,
        jobTitle: false,
        timezone: false,
        newPassword: false,
        assignGroup: false
      },
      newGroup: 0,
      newPassword: '',
      user: {
        email: '',
        name: '',
        location: '',
        jobTitle: '',
        timezone: '',
        groups: [],
        isActive: false,
        isVerified: false
      },
      timezones: [
        { text: '(GMT-11:00) Niue', value: 'Pacific/Niue' },
        { text: '(GMT-11:00) Pago Pago', value: 'Pacific/Pago_Pago' },
        { text: '(GMT-10:00) Hawaii Time', value: 'Pacific/Honolulu' },
        { text: '(GMT-10:00) Rarotonga', value: 'Pacific/Rarotonga' },
        { text: '(GMT-10:00) Tahiti', value: 'Pacific/Tahiti' },
        { text: '(GMT-09:30) Marquesas', value: 'Pacific/Marquesas' },
        { text: '(GMT-09:00) Alaska Time', value: 'America/Anchorage' },
        { text: '(GMT-09:00) Gambier', value: 'Pacific/Gambier' },
        { text: '(GMT-08:00) Pacific Time', value: 'America/Los_Angeles' },
        { text: '(GMT-08:00) Pacific Time - Tijuana', value: 'America/Tijuana' },
        { text: '(GMT-08:00) Pacific Time - Vancouver', value: 'America/Vancouver' },
        { text: '(GMT-08:00) Pacific Time - Whitehorse', value: 'America/Whitehorse' },
        { text: '(GMT-08:00) Pitcairn', value: 'Pacific/Pitcairn' },
        { text: '(GMT-07:00) Mountain Time', value: 'America/Denver' },
        { text: '(GMT-07:00) Mountain Time - Arizona', value: 'America/Phoenix' },
        { text: '(GMT-07:00) Mountain Time - Chihuahua, Mazatlan', value: 'America/Mazatlan' },
        { text: '(GMT-07:00) Mountain Time - Dawson Creek', value: 'America/Dawson_Creek' },
        { text: '(GMT-07:00) Mountain Time - Edmonton', value: 'America/Edmonton' },
        { text: '(GMT-07:00) Mountain Time - Hermosillo', value: 'America/Hermosillo' },
        { text: '(GMT-07:00) Mountain Time - Yellowknife', value: 'America/Yellowknife' },
        { text: '(GMT-06:00) Belize', value: 'America/Belize' },
        { text: '(GMT-06:00) Central Time', value: 'America/Chicago' },
        { text: '(GMT-06:00) Central Time - Mexico City', value: 'America/Mexico_City' },
        { text: '(GMT-06:00) Central Time - Regina', value: 'America/Regina' },
        { text: '(GMT-06:00) Central Time - Tegucigalpa', value: 'America/Tegucigalpa' },
        { text: '(GMT-06:00) Central Time - Winnipeg', value: 'America/Winnipeg' },
        { text: '(GMT-06:00) Costa Rica', value: 'America/Costa_Rica' },
        { text: '(GMT-06:00) El Salvador', value: 'America/El_Salvador' },
        { text: '(GMT-06:00) Galapagos', value: 'Pacific/Galapagos' },
        { text: '(GMT-06:00) Guatemala', value: 'America/Guatemala' },
        { text: '(GMT-06:00) Managua', value: 'America/Managua' },
        { text: '(GMT-05:00) America Cancun', value: 'America/Cancun' },
        { text: '(GMT-05:00) Bogota', value: 'America/Bogota' },
        { text: '(GMT-05:00) Easter Island', value: 'Pacific/Easter' },
        { text: '(GMT-05:00) Eastern Time', value: 'America/New_York' },
        { text: '(GMT-05:00) Eastern Time - Iqaluit', value: 'America/Iqaluit' },
        { text: '(GMT-05:00) Eastern Time - Toronto', value: 'America/Toronto' },
        { text: '(GMT-05:00) Guayaquil', value: 'America/Guayaquil' },
        { text: '(GMT-05:00) Havana', value: 'America/Havana' },
        { text: '(GMT-05:00) Jamaica', value: 'America/Jamaica' },
        { text: '(GMT-05:00) Lima', value: 'America/Lima' },
        { text: '(GMT-05:00) Nassau', value: 'America/Nassau' },
        { text: '(GMT-05:00) Panama', value: 'America/Panama' },
        { text: '(GMT-05:00) Port-au-Prince', value: 'America/Port-au-Prince' },
        { text: '(GMT-05:00) Rio Branco', value: 'America/Rio_Branco' },
        { text: '(GMT-04:00) Atlantic Time - Halifax', value: 'America/Halifax' },
        { text: '(GMT-04:00) Barbados', value: 'America/Barbados' },
        { text: '(GMT-04:00) Bermuda', value: 'Atlantic/Bermuda' },
        { text: '(GMT-04:00) Boa Vista', value: 'America/Boa_Vista' },
        { text: '(GMT-04:00) Caracas', value: 'America/Caracas' },
        { text: '(GMT-04:00) Curacao', value: 'America/Curacao' },
        { text: '(GMT-04:00) Grand Turk', value: 'America/Grand_Turk' },
        { text: '(GMT-04:00) Guyana', value: 'America/Guyana' },
        { text: '(GMT-04:00) La Paz', value: 'America/La_Paz' },
        { text: '(GMT-04:00) Manaus', value: 'America/Manaus' },
        { text: '(GMT-04:00) Martinique', value: 'America/Martinique' },
        { text: '(GMT-04:00) Port of Spain', value: 'America/Port_of_Spain' },
        { text: '(GMT-04:00) Porto Velho', value: 'America/Porto_Velho' },
        { text: '(GMT-04:00) Puerto Rico', value: 'America/Puerto_Rico' },
        { text: '(GMT-04:00) Santo Domingo', value: 'America/Santo_Domingo' },
        { text: '(GMT-04:00) Thule', value: 'America/Thule' },
        { text: '(GMT-03:30) Newfoundland Time - St. Johns', value: 'America/St_Johns' },
        { text: '(GMT-03:00) Araguaina', value: 'America/Araguaina' },
        { text: '(GMT-03:00) Asuncion', value: 'America/Asuncion' },
        { text: '(GMT-03:00) Belem', value: 'America/Belem' },
        { text: '(GMT-03:00) Buenos Aires', value: 'America/Argentina/Buenos_Aires' },
        { text: '(GMT-03:00) Campo Grande', value: 'America/Campo_Grande' },
        { text: '(GMT-03:00) Cayenne', value: 'America/Cayenne' },
        { text: '(GMT-03:00) Cuiaba', value: 'America/Cuiaba' },
        { text: '(GMT-03:00) Fortaleza', value: 'America/Fortaleza' },
        { text: '(GMT-03:00) Godthab', value: 'America/Godthab' },
        { text: '(GMT-03:00) Maceio', value: 'America/Maceio' },
        { text: '(GMT-03:00) Miquelon', value: 'America/Miquelon' },
        { text: '(GMT-03:00) Montevideo', value: 'America/Montevideo' },
        { text: '(GMT-03:00) Palmer', value: 'Antarctica/Palmer' },
        { text: '(GMT-03:00) Paramaribo', value: 'America/Paramaribo' },
        { text: '(GMT-03:00) Punta Arenas', value: 'America/Punta_Arenas' },
        { text: '(GMT-03:00) Recife', value: 'America/Recife' },
        { text: '(GMT-03:00) Rothera', value: 'Antarctica/Rothera' },
        { text: '(GMT-03:00) Salvador', value: 'America/Bahia' },
        { text: '(GMT-03:00) Santiago', value: 'America/Santiago' },
        { text: '(GMT-03:00) Stanley', value: 'Atlantic/Stanley' },
        { text: '(GMT-02:00) Noronha', value: 'America/Noronha' },
        { text: '(GMT-02:00) Sao Paulo', value: 'America/Sao_Paulo' },
        { text: '(GMT-02:00) South Georgia', value: 'Atlantic/South_Georgia' },
        { text: '(GMT-01:00) Azores', value: 'Atlantic/Azores' },
        { text: '(GMT-01:00) Cape Verde', value: 'Atlantic/Cape_Verde' },
        { text: '(GMT-01:00) Scoresbysund', value: 'America/Scoresbysund' },
        { text: '(GMT+00:00) Abidjan', value: 'Africa/Abidjan' },
        { text: '(GMT+00:00) Accra', value: 'Africa/Accra' },
        { text: '(GMT+00:00) Bissau', value: 'Africa/Bissau' },
        { text: '(GMT+00:00) Canary Islands', value: 'Atlantic/Canary' },
        { text: '(GMT+00:00) Casablanca', value: 'Africa/Casablanca' },
        { text: '(GMT+00:00) Danmarkshavn', value: 'America/Danmarkshavn' },
        { text: '(GMT+00:00) Dublin', value: 'Europe/Dublin' },
        { text: '(GMT+00:00) El Aaiun', value: 'Africa/El_Aaiun' },
        { text: '(GMT+00:00) Faeroe', value: 'Atlantic/Faroe' },
        { text: '(GMT+00:00) GMT (no daylight saving)', value: 'Etc/GMT' },
        { text: '(GMT+00:00) Lisbon', value: 'Europe/Lisbon' },
        { text: '(GMT+00:00) London', value: 'Europe/London' },
        { text: '(GMT+00:00) Monrovia', value: 'Africa/Monrovia' },
        { text: '(GMT+00:00) Reykjavik', value: 'Atlantic/Reykjavik' },
        { text: '(GMT+01:00) Algiers', value: 'Africa/Algiers' },
        { text: '(GMT+01:00) Amsterdam', value: 'Europe/Amsterdam' },
        { text: '(GMT+01:00) Andorra', value: 'Europe/Andorra' },
        { text: '(GMT+01:00) Berlin', value: 'Europe/Berlin' },
        { text: '(GMT+01:00) Brussels', value: 'Europe/Brussels' },
        { text: '(GMT+01:00) Budapest', value: 'Europe/Budapest' },
        { text: '(GMT+01:00) Central European Time - Belgrade', value: 'Europe/Belgrade' },
        { text: '(GMT+01:00) Central European Time - Prague', value: 'Europe/Prague' },
        { text: '(GMT+01:00) Ceuta', value: 'Africa/Ceuta' },
        { text: '(GMT+01:00) Copenhagen', value: 'Europe/Copenhagen' },
        { text: '(GMT+01:00) Gibraltar', value: 'Europe/Gibraltar' },
        { text: '(GMT+01:00) Lagos', value: 'Africa/Lagos' },
        { text: '(GMT+01:00) Luxembourg', value: 'Europe/Luxembourg' },
        { text: '(GMT+01:00) Madrid', value: 'Europe/Madrid' },
        { text: '(GMT+01:00) Malta', value: 'Europe/Malta' },
        { text: '(GMT+01:00) Monaco', value: 'Europe/Monaco' },
        { text: '(GMT+01:00) Ndjamena', value: 'Africa/Ndjamena' },
        { text: '(GMT+01:00) Oslo', value: 'Europe/Oslo' },
        { text: '(GMT+01:00) Paris', value: 'Europe/Paris' },
        { text: '(GMT+01:00) Rome', value: 'Europe/Rome' },
        { text: '(GMT+01:00) Stockholm', value: 'Europe/Stockholm' },
        { text: '(GMT+01:00) Tirane', value: 'Europe/Tirane' },
        { text: '(GMT+01:00) Tunis', value: 'Africa/Tunis' },
        { text: '(GMT+01:00) Vienna', value: 'Europe/Vienna' },
        { text: '(GMT+01:00) Warsaw', value: 'Europe/Warsaw' },
        { text: '(GMT+01:00) Zurich', value: 'Europe/Zurich' },
        { text: '(GMT+02:00) Amman', value: 'Asia/Amman' },
        { text: '(GMT+02:00) Athens', value: 'Europe/Athens' },
        { text: '(GMT+02:00) Beirut', value: 'Asia/Beirut' },
        { text: '(GMT+02:00) Bucharest', value: 'Europe/Bucharest' },
        { text: '(GMT+02:00) Cairo', value: 'Africa/Cairo' },
        { text: '(GMT+02:00) Chisinau', value: 'Europe/Chisinau' },
        { text: '(GMT+02:00) Damascus', value: 'Asia/Damascus' },
        { text: '(GMT+02:00) Gaza', value: 'Asia/Gaza' },
        { text: '(GMT+02:00) Helsinki', value: 'Europe/Helsinki' },
        { text: '(GMT+02:00) Jerusalem', value: 'Asia/Jerusalem' },
        { text: '(GMT+02:00) Johannesburg', value: 'Africa/Johannesburg' },
        { text: '(GMT+02:00) Khartoum', value: 'Africa/Khartoum' },
        { text: '(GMT+02:00) Kiev', value: 'Europe/Kiev' },
        { text: '(GMT+02:00) Maputo', value: 'Africa/Maputo' },
        { text: '(GMT+02:00) Moscow-01 - Kaliningrad', value: 'Europe/Kaliningrad' },
        { text: '(GMT+02:00) Nicosia', value: 'Asia/Nicosia' },
        { text: '(GMT+02:00) Riga', value: 'Europe/Riga' },
        { text: '(GMT+02:00) Sofia', value: 'Europe/Sofia' },
        { text: '(GMT+02:00) Tallinn', value: 'Europe/Tallinn' },
        { text: '(GMT+02:00) Tripoli', value: 'Africa/Tripoli' },
        { text: '(GMT+02:00) Vilnius', value: 'Europe/Vilnius' },
        { text: '(GMT+02:00) Windhoek', value: 'Africa/Windhoek' },
        { text: '(GMT+03:00) Baghdad', value: 'Asia/Baghdad' },
        { text: '(GMT+03:00) Istanbul', value: 'Europe/Istanbul' },
        { text: '(GMT+03:00) Minsk', value: 'Europe/Minsk' },
        { text: '(GMT+03:00) Moscow+00 - Moscow', value: 'Europe/Moscow' },
        { text: '(GMT+03:00) Nairobi', value: 'Africa/Nairobi' },
        { text: '(GMT+03:00) Qatar', value: 'Asia/Qatar' },
        { text: '(GMT+03:00) Riyadh', value: 'Asia/Riyadh' },
        { text: '(GMT+03:00) Syowa', value: 'Antarctica/Syowa' },
        { text: '(GMT+03:30) Tehran', value: 'Asia/Tehran' },
        { text: '(GMT+04:00) Baku', value: 'Asia/Baku' },
        { text: '(GMT+04:00) Dubai', value: 'Asia/Dubai' },
        { text: '(GMT+04:00) Mahe', value: 'Indian/Mahe' },
        { text: '(GMT+04:00) Mauritius', value: 'Indian/Mauritius' },
        { text: '(GMT+04:00) Moscow+01 - Samara', value: 'Europe/Samara' },
        { text: '(GMT+04:00) Reunion', value: 'Indian/Reunion' },
        { text: '(GMT+04:00) Tbilisi', value: 'Asia/Tbilisi' },
        { text: '(GMT+04:00) Yerevan', value: 'Asia/Yerevan' },
        { text: '(GMT+04:30) Kabul', value: 'Asia/Kabul' },
        { text: '(GMT+05:00) Aqtau', value: 'Asia/Aqtau' },
        { text: '(GMT+05:00) Aqtobe', value: 'Asia/Aqtobe' },
        { text: '(GMT+05:00) Ashgabat', value: 'Asia/Ashgabat' },
        { text: '(GMT+05:00) Dushanbe', value: 'Asia/Dushanbe' },
        { text: '(GMT+05:00) Karachi', value: 'Asia/Karachi' },
        { text: '(GMT+05:00) Kerguelen', value: 'Indian/Kerguelen' },
        { text: '(GMT+05:00) Maldives', value: 'Indian/Maldives' },
        { text: '(GMT+05:00) Mawson', value: 'Antarctica/Mawson' },
        { text: '(GMT+05:00) Moscow+02 - Yekaterinburg', value: 'Asia/Yekaterinburg' },
        { text: '(GMT+05:00) Tashkent', value: 'Asia/Tashkent' },
        { text: '(GMT+05:30) Colombo', value: 'Asia/Colombo' },
        { text: '(GMT+05:30) India Standard Time', value: 'Asia/Kolkata' },
        { text: '(GMT+05:45) Kathmandu', value: 'Asia/Kathmandu' },
        { text: '(GMT+06:00) Almaty', value: 'Asia/Almaty' },
        { text: '(GMT+06:00) Bishkek', value: 'Asia/Bishkek' },
        { text: '(GMT+06:00) Chagos', value: 'Indian/Chagos' },
        { text: '(GMT+06:00) Dhaka', value: 'Asia/Dhaka' },
        { text: '(GMT+06:00) Moscow+03 - Omsk', value: 'Asia/Omsk' },
        { text: '(GMT+06:00) Thimphu', value: 'Asia/Thimphu' },
        { text: '(GMT+06:00) Vostok', value: 'Antarctica/Vostok' },
        { text: '(GMT+06:30) Cocos', value: 'Indian/Cocos' },
        { text: '(GMT+06:30) Rangoon', value: 'Asia/Yangon' },
        { text: '(GMT+07:00) Bangkok', value: 'Asia/Bangkok' },
        { text: '(GMT+07:00) Christmas', value: 'Indian/Christmas' },
        { text: '(GMT+07:00) Davis', value: 'Antarctica/Davis' },
        { text: '(GMT+07:00) Hanoi', value: 'Asia/Saigon' },
        { text: '(GMT+07:00) Hovd', value: 'Asia/Hovd' },
        { text: '(GMT+07:00) Jakarta', value: 'Asia/Jakarta' },
        { text: '(GMT+07:00) Moscow+04 - Krasnoyarsk', value: 'Asia/Krasnoyarsk' },
        { text: '(GMT+08:00) Brunei', value: 'Asia/Brunei' },
        { text: '(GMT+08:00) China Time - Beijing', value: 'Asia/Shanghai' },
        { text: '(GMT+08:00) Choibalsan', value: 'Asia/Choibalsan' },
        { text: '(GMT+08:00) Hong Kong', value: 'Asia/Hong_Kong' },
        { text: '(GMT+08:00) Kuala Lumpur', value: 'Asia/Kuala_Lumpur' },
        { text: '(GMT+08:00) Macau', value: 'Asia/Macau' },
        { text: '(GMT+08:00) Makassar', value: 'Asia/Makassar' },
        { text: '(GMT+08:00) Manila', value: 'Asia/Manila' },
        { text: '(GMT+08:00) Moscow+05 - Irkutsk', value: 'Asia/Irkutsk' },
        { text: '(GMT+08:00) Singapore', value: 'Asia/Singapore' },
        { text: '(GMT+08:00) Taipei', value: 'Asia/Taipei' },
        { text: '(GMT+08:00) Ulaanbaatar', value: 'Asia/Ulaanbaatar' },
        { text: '(GMT+08:00) Western Time - Perth', value: 'Australia/Perth' },
        { text: '(GMT+08:30) Pyongyang', value: 'Asia/Pyongyang' },
        { text: '(GMT+09:00) Dili', value: 'Asia/Dili' },
        { text: '(GMT+09:00) Jayapura', value: 'Asia/Jayapura' },
        { text: '(GMT+09:00) Moscow+06 - Yakutsk', value: 'Asia/Yakutsk' },
        { text: '(GMT+09:00) Palau', value: 'Pacific/Palau' },
        { text: '(GMT+09:00) Seoul', value: 'Asia/Seoul' },
        { text: '(GMT+09:00) Tokyo', value: 'Asia/Tokyo' },
        { text: '(GMT+09:30) Central Time - Darwin', value: 'Australia/Darwin' },
        { text: '(GMT+10:00) Dumont D\'Urville', value: 'Antarctica/DumontDUrville' },
        { text: '(GMT+10:00) Eastern Time - Brisbane', value: 'Australia/Brisbane' },
        { text: '(GMT+10:00) Guam', value: 'Pacific/Guam' },
        { text: '(GMT+10:00) Moscow+07 - Vladivostok', value: 'Asia/Vladivostok' },
        { text: '(GMT+10:00) Port Moresby', value: 'Pacific/Port_Moresby' },
        { text: '(GMT+10:00) Truk', value: 'Pacific/Chuuk' },
        { text: '(GMT+10:30) Central Time - Adelaide', value: 'Australia/Adelaide' },
        { text: '(GMT+11:00) Casey', value: 'Antarctica/Casey' },
        { text: '(GMT+11:00) Eastern Time - Hobart', value: 'Australia/Hobart' },
        { text: '(GMT+11:00) Eastern Time - Melbourne, Sydney', value: 'Australia/Sydney' },
        { text: '(GMT+11:00) Efate', value: 'Pacific/Efate' },
        { text: '(GMT+11:00) Guadalcanal', value: 'Pacific/Guadalcanal' },
        { text: '(GMT+11:00) Kosrae', value: 'Pacific/Kosrae' },
        { text: '(GMT+11:00) Moscow+08 - Magadan', value: 'Asia/Magadan' },
        { text: '(GMT+11:00) Norfolk', value: 'Pacific/Norfolk' },
        { text: '(GMT+11:00) Noumea', value: 'Pacific/Noumea' },
        { text: '(GMT+11:00) Ponape', value: 'Pacific/Pohnpei' },
        { text: '(GMT+12:00) Funafuti', value: 'Pacific/Funafuti' },
        { text: '(GMT+12:00) Kwajalein', value: 'Pacific/Kwajalein' },
        { text: '(GMT+12:00) Majuro', value: 'Pacific/Majuro' },
        { text: '(GMT+12:00) Moscow+09 - Petropavlovsk-Kamchatskiy', value: 'Asia/Kamchatka' },
        { text: '(GMT+12:00) Nauru', value: 'Pacific/Nauru' },
        { text: '(GMT+12:00) Tarawa', value: 'Pacific/Tarawa' },
        { text: '(GMT+12:00) Wake', value: 'Pacific/Wake' },
        { text: '(GMT+12:00) Wallis', value: 'Pacific/Wallis' },
        { text: '(GMT+13:00) Auckland', value: 'Pacific/Auckland' },
        { text: '(GMT+13:00) Enderbury', value: 'Pacific/Enderbury' },
        { text: '(GMT+13:00) Fakaofo', value: 'Pacific/Fakaofo' },
        { text: '(GMT+13:00) Fiji', value: 'Pacific/Fiji' },
        { text: '(GMT+13:00) Tongatapu', value: 'Pacific/Tongatapu' },
        { text: '(GMT+14:00) Apia', value: 'Pacific/Apia' },
        { text: '(GMT+14:00) Kiritimati', value: 'Pacific/Kiritimati' }
      ]
    }
  },
  computed: {
    currentUserId: get('user/id')
  },
  methods: {
    deleteUser() {},
    async updateUser() {
      this.$store.commit(`loadingStart`, 'admin-users-update')
      const resp = await this.$apollo.mutate({
        mutation: updateUserMutation,
        variables: {
          id: this.user.id,
          email: this.user.email,
          name: this.user.name,
          newPassword: this.newPassword,
          groups: _.map(this.user.groups, 'id'),
          location: this.user.location,
          jobTitle: this.user.jobTitle,
          timezone: this.user.timezone
        }
      })
      if (_.get(resp, 'data.users.update.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: this.$t('admin:users.userUpdateSuccess'),
          icon: 'check'
        })
        this.$router.push('/users')
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.users.update.responseResult.message', 'An unexpected error occured.'),
          icon: 'warning'
        })
      }
      this.$store.commit(`loadingStop`, 'admin-users-update')
    },
    focusField (ipt) {
      this.$nextTick(() => {
        _.delay(() => {
          this.$refs[ipt].focus()
        }, 200)
      })
    },
    assignGroup() {
      if (_.some(this.user.groups, ['id', this.newGroup])) {
        this.$store.commit('showNotification', {
          message: this.$t('admin:users.userAlreadyAssignedToGroup'),
          style: 'error',
          icon: 'alert'
        })
      } else {
        this.user.groups.push(_.find(this.groups, ['id', this.newGroup]))
        this.newGroup = 0
      }
    },
    unassignGroup(gid) {
      this.user.groups = _.reject(this.user.groups, ['id', gid])
    }
  },
  apollo: {
    user: {
      query: userQuery,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.users.single,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-refresh')
      }
    },
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-groups-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
