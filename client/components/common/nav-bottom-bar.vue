<template lang='pug'>
  .nav-bottom-bar(:class='$vuetify.theme.dark ? `nav-bottom-bar--dark` : ``')
    //- Language
    v-menu(v-if='locales.length > 0', offset-y, top, transition='slide-y-transition', max-height='320px', min-width='210px')
      template(v-slot:activator='{ on, attrs }')
        v-btn.nav-bottom-bar__btn(text, v-bind='attrs', v-on='on', :aria-label='$t(`common:header.language`)')
          v-icon(color='grey lighten-1') mdi-web
      v-list(nav)
        template(v-for='(lc, idx) of locales')
          v-list-item(@click='changeLocale(lc)')
            v-list-item-action(style='min-width:auto;'): v-chip(:color='lc.code === locale ? `blue` : `grey`', small, label, dark) {{lc.code.toUpperCase()}}
            v-list-item-title {{lc.name}}
    v-btn.nav-bottom-bar__btn(v-else, text, disabled)
      v-icon(color='grey darken-1') mdi-web

    //- Page actions
    v-menu(v-if='hasAnyPagePermissions && path && mode !== `edit`', offset-y, top, transition='slide-y-transition')
      template(v-slot:activator='{ on, attrs }')
        v-btn.nav-bottom-bar__btn(text, v-bind='attrs', v-on='on', :aria-label='$t(`common:header.pageActions`)')
          v-icon(color='grey lighten-1') mdi-file-document-edit-outline
      v-list(nav, :light='!$vuetify.theme.dark', :dark='$vuetify.theme.dark', :class='$vuetify.theme.dark ? `grey darken-4` : ``')
        .overline.pa-4.grey--text {{$t('common:header.currentPage')}}
        v-list-item.pl-4(@click='pageView', v-if='mode !== `view`')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-file-document-outline
          v-list-item-title.body-2 {{$t('common:header.view')}}
        v-list-item.pl-4(@click='pageEdit', v-if='mode !== `edit` && hasWritePagesPermission')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-file-document-edit-outline
          v-list-item-title.body-2 {{$t('common:header.edit')}}
        v-list-item.pl-4(@click='pageHistory', v-if='mode !== `history` && hasReadHistoryPermission')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-history
          v-list-item-content
            v-list-item-title.body-2 {{$t('common:header.history')}}
        v-list-item.pl-4(@click='pageSource', v-if='mode !== `source` && hasReadSourcePermission')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-code-tags
          v-list-item-title.body-2 {{$t('common:header.viewSource')}}
        v-list-item.pl-4(@click='pageConvert', v-if='hasWritePagesPermission')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-lightning-bolt
          v-list-item-title.body-2 {{$t('common:header.convert')}}
        v-list-item.pl-4(@click='pageDuplicate', v-if='hasWritePagesPermission')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-content-duplicate
          v-list-item-title.body-2 {{$t('common:header.duplicate')}}
        v-list-item.pl-4(@click='pageMove', v-if='hasManagePagesPermission')
          v-list-item-avatar(size='24', tile): v-icon(color='indigo') mdi-content-save-move-outline
          v-list-item-content
            v-list-item-title.body-2 {{$t('common:header.move')}}
        v-list-item.pl-4(@click='pageDelete', v-if='hasDeletePagesPermission')
          v-list-item-avatar(size='24', tile): v-icon(color='red darken-2') mdi-trash-can-outline
          v-list-item-title.body-2 {{$t('common:header.delete')}}
    v-btn.nav-bottom-bar__btn(v-else, text, disabled)
      v-icon(color='grey darken-1') mdi-file-document-edit-outline

    //- New page
    v-btn.nav-bottom-bar__btn(v-if='hasNewPagePermission && mode !== `edit`', text, @click='pageNew', :aria-label='$t(`common:header.newPage`)')
      v-icon(color='grey lighten-1') mdi-plus-box-outline
    v-btn.nav-bottom-bar__btn(v-else, text, disabled)
      v-icon(color='grey darken-1') mdi-plus-box-outline

    //- Admin
    v-btn.nav-bottom-bar__btn(v-if='mode !== `admin`', text, href='/a', :aria-label='$t(`common:header.admin`)')
      v-icon(color='grey lighten-1') mdi-cog
    v-btn.nav-bottom-bar__btn(v-else, text, href='/', :aria-label='$t(`common:actions.exit`)')
      v-icon(color='grey lighten-1') mdi-exit-to-app
</template>

<script>
import { get } from 'vuex-pathify'
import _ from 'lodash'

/* global siteLangs */

export default {
  data() {
    return {
      locales: siteLangs
    }
  },
  computed: {
    path: get('page/path'),
    locale: get('page/locale'),
    mode: get('page/mode'),
    permissions: get('user/permissions'),
    hasNewPagePermission () {
      return this.hasAdminPermission || _.intersection(this.permissions, ['write:pages']).length > 0
    },
    hasAdminPermission: get('page/effectivePermissions@system.manage'),
    hasWritePagesPermission: get('page/effectivePermissions@pages.write'),
    hasManagePagesPermission: get('page/effectivePermissions@pages.manage'),
    hasDeletePagesPermission: get('page/effectivePermissions@pages.delete'),
    hasReadSourcePermission: get('page/effectivePermissions@source.read'),
    hasReadHistoryPermission: get('page/effectivePermissions@history.read'),
    hasAnyPagePermissions () {
      return this.hasAdminPermission || this.hasWritePagesPermission || this.hasManagePagesPermission ||
        this.hasDeletePagesPermission || this.hasReadSourcePermission || this.hasReadHistoryPermission
    }
  },
  methods: {
    pageNew () {
      this.$root.$emit('pageNew')
    },
    pageView () {
      window.location.assign(`/${this.locale}/${this.path}`)
    },
    pageEdit () {
      this.$root.$emit('pageEdit')
    },
    pageHistory () {
      this.$root.$emit('pageHistory')
    },
    pageSource () {
      this.$root.$emit('pageSource')
    },
    pageConvert () {
      this.$root.$emit('pageConvert')
    },
    pageDuplicate () {
      this.$root.$emit('pageDuplicate')
    },
    pageMove () {
      this.$root.$emit('pageMove')
    },
    pageDelete () {
      this.$root.$emit('pageDelete')
    },
    async changeLocale (locale) {
      await this.$i18n.i18next.changeLanguage(locale.code)
      if (this.path && (this.mode === 'view' || this.mode === 'history')) {
        window.location.assign(`/${locale.code}/${this.path}`)
      }
    }
  }
}
</script>

<style lang='scss'>
.nav-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background-color: #000;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  z-index: 220;
  padding: 0 8px;
  padding-bottom: env(safe-area-inset-bottom, 0);

  &--dark {
    background-color: #1e1e1e;
  }

  &__btn {
    flex: 1;
    max-width: 80px;
    min-width: 48px !important;
    height: 48px !important;
  }
}
</style>
