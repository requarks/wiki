<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/_assets/svg/icon-profile.svg', alt='Users', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('profile:title')}}
            .subheading.grey--text.animated.fadeInLeft {{$t('profile:subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='saveProfile', :loading='saveLoading', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.save')}}
          //- v-btn.animated.fadeInDown(outlined, color='primary', disabled).mr-0
          //-   v-icon(left) mdi-earth
          //-   span {{$t('profile:viewPublicProfile')}}
      v-flex(lg6 xs12)
        v-card.animated.fadeInUp
          v-toolbar(color='blue-grey', dark, dense, flat)
            v-toolbar-title.subtitle-1 {{$t('profile:myInfo')}}
          v-list(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-account
              v-list-item-content
                v-list-item-title {{$t('profile:displayName')}}
                v-list-item-subtitle {{ user.name }}
              v-list-item-action
                v-menu(
                  v-model='editPop.name'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptDisplayName`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card
                    v-text-field(
                      ref='iptDisplayName'
                      v-model='user.name'
                      :label='$t(`profile:displayName`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.name = false'
                      @keydown.enter='editPop.name = false'
                      @keydown.esc='editPop.name = false'
                    )
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-marker
              v-list-item-content
                v-list-item-title {{$t('profile:location')}}
                v-list-item-subtitle {{ user.location }}
              v-list-item-action
                v-menu(
                  v-model='editPop.location'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptLocation`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card
                    v-text-field(
                      ref='iptLocation'
                      v-model='user.location'
                      :label='$t(`profile:location`)'
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
                v-icon mdi-briefcase
              v-list-item-content
                v-list-item-title {{$t('profile:jobTitle')}}
                v-list-item-subtitle {{ user.jobTitle }}
              v-list-item-action
                v-menu(
                  v-model='editPop.jobTitle'
                  :close-on-content-click='false'
                  min-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptJobTitle`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card
                    v-text-field(
                      ref='iptJobTitle'
                      v-model='user.jobTitle'
                      :label='$t(`profile:jobTitle`)'
                      solo
                      hide-details
                      append-icon='mdi-check'
                      @click:append='editPop.jobTitle = false'
                      @keydown.enter='editPop.jobTitle = false'
                      @keydown.esc='editPop.jobTitle = false'
                    )

        v-card.mt-3.animated.fadeInUp.wait-p2s
          v-toolbar(color='blue-grey', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:auth.title')}}
          v-card-text.pt-0
            v-subheader.pl-0: span.subtitle-2 {{$t('profile:auth.provider')}}
            v-toolbar(
              flat
              :color='$vuetify.theme.dark ? "grey darken-2" : "purple lighten-5"'
              dense
              :class='$vuetify.theme.dark ? "grey--text text--lighten-1" : "purple--text text--darken-4"'
              )
              v-icon(:color='$vuetify.theme.dark ? "grey lighten-1" : "purple darken-4"') mdi-shield-lock
              .subheading.ml-3 {{ user.providerName }}
            //- v-divider.mt-3
            //- v-subheader.pl-0: span.subtitle-2 Two-Factor Authentication (2FA)
            //- .caption.mb-2 2FA adds an extra layer of security by requiring a unique code generated on your smartphone when signing in.
            //- v-btn(color='purple darken-4', disabled).ml-0 Enable 2FA
            //- v-btn(color='purple darken-4', dark, depressed, disabled).ml-0 Disable 2FA
            template(v-if='user.providerKey === `local`')
              v-divider.mt-3
              v-subheader.pl-0: span.subtitle-2 {{$t('profile:auth.changePassword')}}
              v-text-field(
                ref='iptCurrentPass'
                v-model='currentPass'
                outlined
                :label='$t(`profile:auth.currentPassword`)'
                type='password'
                prepend-inner-icon='mdi-form-textbox-password'
                )
              v-text-field(
                ref='iptNewPass'
                v-model='newPass'
                outlined
                :label='$t(`profile:auth.newPassword`)'
                type='password'
                prepend-inner-icon='mdi-form-textbox-password'
                autocomplete='off'
                counter='255'
                loading
                )
                password-strength(slot='progress', v-model='newPass')
              v-text-field(
                ref='iptVerifyPass'
                v-model='verifyPass'
                outlined
                :label='$t(`profile:auth.verifyPassword`)'
                type='password'
                prepend-inner-icon='mdi-form-textbox-password'
                autocomplete='off'
                hide-details
                )
          v-card-chin(v-if='user.providerKey === `local`')
            v-spacer
            v-btn.px-4(color='purple darken-4', dark, depressed, @click='changePassword', :loading='changePassLoading')
              v-icon(left) mdi-progress-check
              span {{$t('profile:auth.changePassword')}}
      v-flex(lg6 xs12)
        //- v-card
        //-   v-toolbar(color='blue-grey', dark, dense, flat)
        //-     v-toolbar-title
        //-       .subtitle-1 Picture
        //-   v-card-title
        //-     v-avatar.blue(v-if='picture.kind === `initials`', :size='40')
        //-       span.white--text.subheading {{picture.initials}}
        //-     v-avatar(v-else-if='picture.kind === `image`', :size='40')
        //-       v-img(:src='picture.url')
        //-     v-btn(outlined).mx-4 Upload Picture
        //-     v-btn(outlined, disabled) Remove Picture
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='blue-grey', dark, dense, flat)
            v-toolbar-title.subtitle-1 {{$t('profile:preferences')}}
          v-list(two-line, dense)
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-map-clock-outline
              v-list-item-content
                v-list-item-title {{$t('profile:timezone')}}
                v-list-item-subtitle {{ user.timezone }}
              v-list-item-action
                v-menu(
                  v-model='editPop.timezone'
                  :close-on-content-click='false'
                  min-width='350'
                  max-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptTimezone`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card(flat)
                    v-select(
                      ref='iptTimezone'
                      :items='timezones'
                      v-model='user.timezone'
                      :label='$t(`profile:timezone`)'
                      solo
                      flat
                      dense
                      hide-details
                      @keydown.enter='editPop.timezone = false'
                      @keydown.esc='editPop.timezone = false'
                      style='height: 38px;'
                    )
                    v-card-chin
                      v-spacer
                      v-btn(
                        small
                        text
                        color='primary'
                        @click='editPop.timezone = false'
                        )
                        v-icon(left) mdi-check
                        span {{$t('common:actions.ok')}}
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-calendar-month-outline
              v-list-item-content
                v-list-item-title {{$t('profile:dateFormat')}}
                v-list-item-subtitle {{ user.dateFormat && user.dateFormat.length > 0 ? user.dateFormat : $t('profile:localeDefault') }}
              v-list-item-action
                v-menu(
                  v-model='editPop.dateFormat'
                  :close-on-content-click='false'
                  min-width='350'
                  max-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptDateFormat`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card(flat)
                    v-select(
                      ref='iptDateFormat'
                      :items='dateFormats'
                      v-model='user.dateFormat'
                      :label='$t(`profile:dateFormat`)'
                      solo
                      flat
                      dense
                      hide-details
                      @keydown.enter='editPop.dateFormat = false'
                      @keydown.esc='editPop.dateFormat = false'
                      style='height: 38px;'
                    )
                    v-card-chin
                      v-spacer
                      v-btn(
                        small
                        text
                        color='primary'
                        @click='editPop.dateFormat = false'
                        )
                        v-icon(left) mdi-check
                        span {{$t('common:actions.ok')}}
            v-divider
            v-list-item
              v-list-item-avatar(size='32')
                v-icon mdi-palette
              v-list-item-content
                v-list-item-title {{$t('profile:appearance')}}
                v-list-item-subtitle {{ currentAppearance }}
              v-list-item-action
                v-menu(
                  v-model='editPop.appearance'
                  :close-on-content-click='false'
                  min-width='350'
                  max-width='350'
                  left
                  )
                  template(v-slot:activator='{ on }')
                    v-btn(text, color='grey', small, v-on='on', @click='focusField(`iptAppearance`)')
                      v-icon(left) mdi-pencil
                      span {{ $t('common:actions:edit') }}
                  v-card(flat)
                    v-select(
                      ref='iptAppearance'
                      :items='appearances'
                      v-model='user.appearance'
                      :label='$t(`profile:appearance`)'
                      solo
                      flat
                      dense
                      hide-details
                      @keydown.enter='editPop.appearance = false'
                      @keydown.esc='editPop.appearance = false'
                      style='height: 38px;'
                    )
                    v-card-chin
                      v-spacer
                      v-btn(
                        small
                        text
                        color='primary'
                        @click='editPop.appearance = false'
                        )
                        v-icon(left) mdi-check
                        span {{$t('common:actions.ok')}}

        v-card.mt-3.animated.fadeInUp.wait-p3s
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:groups.title')}}
          v-list(dense)
            template(v-for='(grp, idx) of user.groups')
              v-list-item(:key='`grp-id-` + grp')
                v-list-item-avatar(size='32')
                  v-icon mdi-account-group
                v-list-item-content
                  v-list-item-title.body-2 {{grp}}
              v-divider(v-if='idx < user.groups.length - 1')

        v-card.mt-3.animated.fadeInUp.wait-p4s
          v-toolbar(color='teal', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 {{$t('profile:activity.title')}}
          v-card-text.grey--text.text--darken-2
            .caption.grey--text {{$t('profile:activity.joinedOn')}}
            .body-2: strong {{ user.createdAt | moment('LLLL') }}
            .caption.grey--text.mt-3 {{$t('profile:activity.lastUpdatedOn')}}
            .body-2: strong {{ user.updatedAt | moment('LLLL') }}
            .caption.grey--text.mt-3 {{$t('profile:activity.lastLoginOn')}}
            .body-2: strong {{ user.lastLoginAt | moment('LLLL') }}
            v-divider.mt-3
            .caption.grey--text.mt-3 {{$t('profile:activity.pagesCreated')}}
            .body-2: strong {{ user.pagesTotal }}
            .caption.grey--text.mt-3 {{$t('profile:activity.commentsPosted')}}
            .body-2: strong 0
</template>

<script>
import { get } from 'vuex-pathify'
import gql from 'graphql-tag'
import _ from 'lodash'
import Cookies from 'js-cookie'
import validate from 'validate.js'

import PasswordStrength from '../common/password-strength.vue'

/* global WIKI, siteConfig */

export default {
  i18nOptions: {
    namespaces: ['profile', 'auth']
  },
  components: {
    PasswordStrength
  },
  data() {
    return {
      saveLoading: false,
      changePassLoading: false,
      user: {
        name: 'unknown',
        location: '',
        jobTitle: '',
        timezone: '',
        dateFormat: '',
        appearance: '',
        createdAt: '1970-01-01',
        updatedAt: '1970-01-01',
        lastLoginAt: '1970-01-01',
        groups: []
      },
      currentPass: '',
      newPass: '',
      verifyPass: '',
      editPop: {
        name: false,
        location: false,
        jobTitle: false,
        timezone: false,
        dateFormat: false,
        appearance: false
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
    dateFormats () {
      return [
        { text: this.$t('profile:localeDefault'), value: '' },
        { text: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
        { text: 'DD.MM.YYYY', value: 'DD.MM.YYYY' },
        { text: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
        { text: 'YYYY-MM-DD', value: 'YYYY-MM-DD' },
        { text: 'YYYY/MM/DD', value: 'YYYY/MM/DD' }
      ]
    },
    appearances () {
      return [
        { text: this.$t('profile:appearanceDefault'), value: '' },
        { text: this.$t('profile:appearanceLight'), value: 'light' },
        { text: this.$t('profile:appearanceDark'), value: 'dark' }
      ]
    },
    currentAppearance () {
      return _.get(_.find(this.appearances, ['value', this.user.appearance]), 'text', false) || this.$t('profile:appearanceDefault')
    },
    pictureUrl: get('user/pictureUrl'),
    picture () {
      if (this.pictureUrl && this.pictureUrl.length > 1) {
        return {
          kind: 'image',
          url: this.pictureUrl
        }
      } else {
        const nameParts = this.user.name.toUpperCase().split(' ')
        let initials = _.head(nameParts).charAt(0)
        if (nameParts.length > 1) {
          initials += _.last(nameParts).charAt(0)
        }
        return {
          kind: 'initials',
          initials
        }
      }
    }
  },
  watch: {
    'user.appearance': (newValue, oldValue) => {
      if (newValue === '') {
        WIKI.$vuetify.theme.dark = siteConfig.darkMode
      } else {
        WIKI.$vuetify.theme.dark = (newValue === 'dark')
      }
    },
    'user.dateFormat': (newValue, oldValue) => {
      if (newValue === '') {
        WIKI.$moment.updateLocale(WIKI.$moment.locale(), null)
      } else {
        WIKI.$moment.updateLocale(WIKI.$moment.locale(), {
          longDateFormat: {
            'L': newValue
          }
        })
      }
    },
    'user.timezone': (newValue, oldValue) => {
      if (newValue === '') {
        WIKI.$moment.tz.setDefault()
      } else {
        WIKI.$moment.tz.setDefault(newValue)
      }
    }
  },
  methods: {
    /**
     * Focus an input after delay
     */
    focusField (ipt) {
      this.$nextTick(() => {
        _.delay(() => {
          this.$refs[ipt].focus()
        }, 200)
      })
    },
    /**
     * Save User Profile
     */
    async saveProfile () {
      this.saveLoading = true
      this.$store.commit(`loadingStart`, 'profile-save')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: gql`
            mutation ($name: String!, $location: String!, $jobTitle: String!, $timezone: String!, $dateFormat: String!, $appearance: String!) {
              users {
                updateProfile(name: $name, location: $location, jobTitle: $jobTitle, timezone: $timezone, dateFormat: $dateFormat, appearance: $appearance) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  jwt
                }
              }
            }
          `,
          variables: {
            name: this.user.name,
            location: this.user.location,
            jobTitle: this.user.jobTitle,
            timezone: this.user.timezone,
            dateFormat: this.user.dateFormat,
            appearance: this.user.appearance
          }
        })
        const resp = _.get(respRaw, 'data.users.updateProfile.responseResult', {})
        if (resp.succeeded) {
          Cookies.set('jwt', _.get(respRaw, 'data.users.updateProfile.jwt', ''), { expires: 365 })
          this.$store.set('user/name', this.user.name)
          this.$store.commit('showNotification', {
            message: this.$t('profile:save.success'),
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'profile-save')
      this.saveLoading = false
    },
    /**
     * Change Password
     */
    async changePassword () {
      const validation = validate({
        current: this.currentPass,
        password: this.newPass,
        verifyPassword: this.verifyPass
      }, {
        current: {
          presence: {
            message: this.$t('auth:missingPassword'),
            allowEmpty: false
          },
          length: {
            minimum: 6,
            tooShort: this.$t('auth:passwordTooShort')
          }
        },
        password: {
          presence: {
            message: this.$t('auth:missingPassword'),
            allowEmpty: false
          },
          length: {
            minimum: 6,
            tooShort: this.$t('auth:passwordTooShort')
          }
        },
        verifyPassword: {
          equality: {
            attribute: 'password',
            message: this.$t('auth:passwordNotMatch')
          }
        }
      }, { fullMessages: false })

      if (validation) {
        if (validation.current) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.current[0],
            icon: 'warning'
          })
          this.$refs.iptCurrentPass.focus()
        } else if (validation.password) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.password[0],
            icon: 'warning'
          })
          this.$refs.iptNewPass.focus()
        } else if (validation.verifyPassword) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: validation.verifyPassword[0],
            icon: 'warning'
          })
          this.$refs.iptVerifyPass.focus()
        }
      } else {
        this.changePassLoading = true
        this.$store.commit(`loadingStart`, 'profile-changepassword')

        try {
          const respRaw = await this.$apollo.mutate({
            mutation: gql`
              mutation ($current: String!, $new: String!) {
                users {
                  changePassword(current: $current, new: $new) {
                    responseResult {
                      succeeded
                      errorCode
                      slug
                      message
                    }
                    jwt
                  }
                }
              }
            `,
            variables: {
              current: this.currentPass,
              new: this.newPass
            }
          })
          const resp = _.get(respRaw, 'data.users.changePassword.responseResult', {})
          if (resp.succeeded) {
            this.currentPass = ''
            this.newPass = ''
            this.verifyPass = ''
            Cookies.set('jwt', _.get(respRaw, 'data.users.changePassword.jwt', ''), { expires: 365 })
            this.$store.commit('showNotification', {
              message: this.$t('profile:auth.changePassSuccess'),
              style: 'success',
              icon: 'check'
            })
          } else {
            throw new Error(resp.message)
          }
        } catch (err) {
          this.$store.commit('pushGraphError', err)
        }

        this.$store.commit(`loadingStop`, 'profile-changepassword')
        this.changePassLoading = false
      }
    }
  },
  apollo: {
    user: {
      query: gql`
        {
          users {
            profile {
              id
              name
              email
              providerKey
              providerName
              isSystem
              isVerified
              location
              jobTitle
              timezone
              dateFormat
              appearance
              createdAt
              updatedAt
              lastLoginAt
              groups
              pagesTotal
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.users.profile),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'profile-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
