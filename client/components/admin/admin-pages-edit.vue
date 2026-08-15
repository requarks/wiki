<template lang='pug'>
  div.admin-page-edit-root
    //- Mobile layout (plain div — avoids v-container width overflow)
    .admin-page-edit.admin-page-edit--mobile(v-if='isMobile && adminPage.id')
      header.admin-page-edit__header
        .admin-page-edit__topbar
          v-btn.admin-page-edit__back(icon, x-small, outlined, color='grey', exact, to='/pages', :aria-label='$t(`newpage.goback`)')
            v-icon(small) mdi-arrow-left
          .admin-page-edit__identity
            .admin-page-edit__pagetitle {{ adminPage.title }}
          page-actions-menu.admin-page-edit__menu(
            :admin-page='adminPage'
            icon-only
            @request-delete='deletePageDialog = true'
          )
        .admin-page-edit__badges
          v-chip(x-small, label, outlined) ID {{ adminPage.id }}
          v-chip(x-small, label, :color='adminPage.isPublished ? `green lighten-4` : `red lighten-4`')
            span.caption(:class='adminPage.isPublished ? `green--text text--darken-2` : `red--text text--darken-2`') {{ publishLabel }}
          v-chip(x-small, label, :color='adminPage.isPrivate ? `deep-orange lighten-4` : `blue lighten-4`')
            span.caption(:class='adminPage.isPrivate ? `deep-orange--text text--darken-2` : `blue--text text--darken-2`') {{ visibilityLabel }}
          .admin-page-edit__path-row
            span.admin-page-edit__path /{{ adminPage.locale }}/{{ adminPage.path }}

      .admin-page-edit__tabbar
        button.admin-page-edit__tab(type='button', :class='{ "is-active": mobileTab === 0 }', @click='mobileTab = 0') Properties
        button.admin-page-edit__tab(type='button', :class='{ "is-active": mobileTab === 1 }', @click='mobileTab = 1') Users

      .admin-page-edit__panel
        template(v-if='mobileTab === 0')
          .admin-page-edit__row(v-for='field in propertyFields', :key='field.label')
            .admin-page-edit__label {{ field.label }}
            .admin-page-edit__value(:class='field.mono ? `admin-page-edit__mono` : ``') {{ field.value }}
        template(v-else)
          .admin-page-edit__row(v-for='field in userFields', :key='field.label')
            .admin-page-edit__label {{ field.label }}
            .admin-page-edit__value
              div(v-if='field.name') {{ field.name }}
              .caption.grey--text(v-if='field.email') {{ field.email }}
              .caption.grey--text.mt-1(v-if='field.date') {{ field.date }}

    //- Desktop layout
    v-container.admin-page-edit(v-else-if='adminPage.id', fluid, :class='containerClass')
      v-layout(row, wrap)
        v-flex(xs12)
          .admin-header
            .admin-header__brand
              img.admin-header__icon.animated.fadeInUp(src='/_assets/svg/icon-view-details.svg', alt='Edit Page')
              .admin-header-title
                .headline.blue--text.text--darken-2.animated.fadeInLeft Page Details
                .subtitle-1.grey--text.admin-header__meta
                  v-chip.ml-0.mr-2(label, small).caption ID {{adminPage.id}}
                  span.admin-header__path /{{adminPage.locale}}/{{adminPage.path}}
            .admin-header__status
              .admin-header__status-item
                template(v-if='adminPage.isPublished')
                  status-indicator(positive, pulse)
                  .caption.green--text {{ publishLabel }}
                template(v-else)
                  status-indicator(negative, pulse)
                  .caption.red--text {{$t('common:page.unpublished')}}
              .admin-header__status-item
                template(v-if='adminPage.isPrivate')
                  status-indicator(intermediary, pulse)
                  .caption.deep-orange--text {{$t('common:page.private')}}
                template(v-else)
                  status-indicator(active, pulse)
                  .caption.blue--text {{$t('common:page.global')}}
            .admin-header__actions
              v-btn.animated.fadeInDown.wait-p3s(color='grey', icon, outlined, to='/pages', :aria-label='$t(`newpage.goback`)')
                v-icon mdi-arrow-left
              page-actions-menu(
                :admin-page='adminPage'
                @request-delete='deletePageDialog = true'
              )
              v-btn.animated.fadeInDown(color='success', large, depressed, disabled)
                v-icon(left) mdi-check
                span Save Changes
        v-flex(xs12, lg6)
          v-card.animated.fadeInUp.admin-pages-edit-card
              v-toolbar(color='primary', dense, dark, flat)
                v-icon.mr-2 mdi-text-subject
                span Properties
              v-list.py-0(two-line, dense)
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Title
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.title }}
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Description
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.description || '-' }}
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Locale
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.locale }}
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Path
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.path }}
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Editor
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.editor || '?' }}
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Content Type
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.contentType || '?' }}
                v-divider
                v-list-item
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Page Hash
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.hash }}

        v-flex(xs12, lg6)
          v-card.animated.fadeInUp.admin-pages-edit-card.wait-p2s
              v-toolbar(color='primary', dense, dark, flat)
                v-icon.mr-2 mdi-account-multiple
                span Users
              v-list.py-0(two-line, dense)
                v-list-item
                  v-list-item-avatar(size='24')
                    v-btn(icon, :to='`/users/` + adminPage.creatorId')
                      v-icon(color='grey') mdi-account
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Creator
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.creatorName }} #[em.caption ({{ adminPage.creatorEmail }})]
                  v-list-item-action
                    v-list-item-action-text {{ adminPage.createdAt | moment('calendar') }}
                v-divider
                v-list-item
                  v-list-item-avatar(size='24')
                    v-btn(icon, :to='`/users/` + adminPage.authorId')
                      v-icon(color='grey') mdi-account
                  v-list-item-content
                    v-list-item-title: .overline.grey--text Last Editor
                    v-list-item-subtitle.body-2(:class='subtitleClass') {{ adminPage.authorName }} #[em.caption ({{ adminPage.authorEmail }})]
                  v-list-item-action
                    v-list-item-action-text {{ adminPage.updatedAt | moment('calendar') }}

    v-dialog(v-model='deletePageDialog', max-width='500')
      v-card
        .dialog-header.is-short.is-red
          v-icon.mr-2(color='white') mdi-file-document-box-remove-outline
          span {{$t('common:page.delete')}}
        v-card-text.pt-5
          i18next.body-2(path='common:page.deleteTitle', tag='div')
            span.red--text.text--darken-2(place='title') {{adminPage.title}}
          .caption {{$t('common:page.deleteSubtitle')}}
          v-chip.mt-3.ml-0.mr-1(label, color='red lighten-4', disabled, small)
            .caption.red--text.text--darken-2 {{adminPage.locale ? adminPage.locale.toUpperCase() : ''}}
          v-chip.mt-3.mx-0(label, color='red lighten-5', disabled, small)
            span.red--text.text--darken-2 /{{adminPage.path}}
        v-card-chin
          v-spacer
          v-btn(text, @click='deletePageDialog = false', :disabled='loading') {{$t('common:actions.cancel')}}
          v-btn(color='red darken-2', @click='deletePage', :loading='loading').white--text {{$t('common:actions.delete')}}

    v-layout.admin-page-edit__loading(row, align-center, v-if='!adminPage.id')
      v-progress-circular(indeterminate, width='2', color='grey')
      .body-2.pl-3.grey--text {{ $t('common:page.loading') }}

</template>
<script>
import _ from 'lodash'
import { StatusIndicator } from 'vue-status-indicator'

import pageQuery from 'gql/admin/pages/pages-query-single.gql'
import deletePageMutation from 'gql/common/common-pages-mutation-delete.gql'
import PageActionsMenu from './admin-page-actions-menu.vue'

export default {
  components: {
    StatusIndicator,
    PageActionsMenu
  },
  computed: {
    isMobile () {
      return this.$vuetify.breakpoint.smAndDown
    },
    containerClass () {
      return {
        'grid-list-lg': !this.isMobile,
        'admin-pages-container': true
      }
    },
    subtitleClass () {
      return this.$vuetify.theme.dark ? 'grey--text text--lighten-2' : 'grey--text text--darken-3'
    },
    publishLabel () {
      return this.adminPage.isPublished ? this.$t('common:page.published') : this.$t('common:page.unpublished')
    },
    visibilityLabel () {
      return this.adminPage.isPrivate ? this.$t('common:page.private') : this.$t('common:page.global')
    },
    propertyFields () {
      return [
        { label: 'Title', value: this.adminPage.title },
        { label: 'Description', value: this.adminPage.description || '-' },
        { label: 'Locale', value: this.adminPage.locale },
        { label: 'Path', value: this.adminPage.path },
        { label: 'Editor', value: this.adminPage.editor || '?' },
        { label: 'Content Type', value: this.adminPage.contentType || '?' },
        { label: 'Page Hash', value: this.adminPage.hash, mono: true }
      ]
    },
    userFields () {
      return [
        {
          label: 'Creator',
          name: this.adminPage.creatorName,
          email: this.adminPage.creatorEmail,
          date: this.$options.filters.moment(this.adminPage.createdAt, 'calendar')
        },
        {
          label: 'Last Editor',
          name: this.adminPage.authorName,
          email: this.adminPage.authorEmail,
          date: this.$options.filters.moment(this.adminPage.updatedAt, 'calendar')
        }
      ]
    }
  },
  data() {
    return {
      deletePageDialog: false,
      adminPage: {},
      loading: false,
      mobileTab: 0
    }
  },
  watch: {
    adminPage: {
      deep: true,
      handler (val) {
        if (val && val.id) {
          this.$root.$emit('adminPageContext', {
            id: val.id,
            locale: val.locale,
            path: val.path
          })
        } else {
          this.$root.$emit('adminPageContext', null)
        }
      }
    }
  },
  beforeDestroy () {
    this.$root.$emit('adminPageContext', null)
  },
  methods: {
    async deletePage() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'page-delete')
      try {
        const resp = await this.$apollo.mutate({
          mutation: deletePageMutation,
          variables: {
            id: this.adminPage.id
          }
        })
        if (_.get(resp, 'data.pages.delete.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'green',
            message: `Page deleted successfully.`,
            icon: 'check'
          })
          this.$router.replace('/pages')
        } else {
          throw new Error(_.get(resp, 'data.pages.delete.responseResult.message', this.$t('common:error.unexpected')))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'page-delete')
    }
  },
  apollo: {
    adminPage: {
      query: pageQuery,
      variables() {
        return {
          id: _.toSafeInteger(this.$route.params.id)
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.pages.single,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-pages-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.admin-page-edit-root {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

.admin-page-edit {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;

  &--mobile {
    padding: 8px;
    overflow-x: hidden;
  }

  &__header {
    width: 100%;
    max-width: 100%;
    margin-bottom: 12px;
    overflow: hidden;
  }

  &__topbar {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) 36px;
    align-items: center;
    column-gap: 6px;
    width: 100%;
    max-width: 100%;
  }

  &__back,
  &__menu {
    justify-self: center;
  }

  &__identity {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }

  &__pagetitle {
    font-size: 0.95rem;
    font-weight: 500;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    max-width: 100%;
  }

  &__path-row {
    flex: 1 1 100%;
    width: 100%;
    max-width: 100%;
    margin-top: 2px;
  }

  &__path {
    display: block;
    font-family: 'Roboto Mono', monospace;
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.54);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;

    @at-root .theme--dark & {
      color: rgba(255, 255, 255, 0.6);
    }
  }

  &__tabbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    max-width: 100%;
    margin-bottom: 12px;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    overflow: hidden;

    @at-root .theme--dark & {
      border-color: rgba(255, 255, 255, 0.12);
    }
  }

  &__tab {
    appearance: none;
    border: none;
    background: transparent;
    padding: 10px 8px;
    font-size: 0.8125rem;
    font-family: inherit;
    color: rgba(0, 0, 0, 0.6);
    cursor: pointer;
    min-width: 0;

    @at-root .theme--dark & {
      color: rgba(255, 255, 255, 0.7);
    }

    &.is-active {
      background: mc('theme', 'primary');
      color: #fff;
    }

    & + & {
      border-left: 1px solid rgba(0, 0, 0, 0.12);

      @at-root .theme--dark & {
        border-left-color: rgba(255, 255, 255, 0.12);
      }
    }
  }

  &__panel {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    background: #fff;

    @at-root .theme--dark & {
      border-color: rgba(255, 255, 255, 0.12);
      background: mc('grey', '900');
    }
  }

  &__row {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);

    @at-root .theme--dark & {
      border-bottom-color: rgba(255, 255, 255, 0.08);
    }

    &:last-child {
      border-bottom: none;
    }
  }

  &__label {
    font-size: 0.6875rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: rgba(0, 0, 0, 0.54);
    margin-bottom: 4px;

    @at-root .theme--dark & {
      color: rgba(255, 255, 255, 0.6);
    }
  }

  &__value {
    font-size: 0.875rem;
    line-height: 1.45;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

  &__mono {
    font-family: 'Roboto Mono', monospace;
    font-size: 0.8125rem;
    word-break: break-all;
    overflow-wrap: anywhere;
  }

  &__loading {
    display: flex;
    align-items: center;
    padding: 24px 8px;
  }
}

@media #{map-get($display-breakpoints, 'sm-and-down')} {
  .admin-page-edit--mobile {
    .admin-page-edit__back.v-btn,
    .admin-page-actions-menu__btn.v-btn {
      min-width: 32px !important;
      width: 32px !important;
      height: 32px !important;
      margin: 0 !important;
      padding: 0 !important;
    }
  }

  .admin-pages-edit-card {
    .v-list-item-subtitle,
    .v-list-item-action-text {
      word-break: break-word;
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }
}
</style>
