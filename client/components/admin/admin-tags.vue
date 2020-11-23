<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-tags.svg', alt='Tags', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('tags.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{$t('tags.subtitle')}}
          v-spacer
          v-btn.animated.fadeInDown(outlined, color='grey', @click='refresh', icon)
            v-icon mdi-refresh
        v-container.pa-0.mt-3(fluid, grid-list-lg)
          v-layout(row)
            v-flex(style='flex: 0 0 350px;')
              v-card.animated.fadeInUp
                v-toolbar(:color='$vuetify.theme.dark ? `grey darken-3-d5` : `grey lighten-4`', flat)
                  v-text-field(
                    v-model='filter'
                    :label='$t(`admin:tags.filter`)'
                    hide-details
                    single-line
                    solo
                    flat
                    dense
                    color='teal'
                    :background-color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-2`'
                    prepend-inner-icon='mdi-magnify'
                  )
                v-divider
                v-list.py-2(dense, nav)
                  v-list-item(v-if='tags.length < 1')
                    v-list-item-avatar(size='24'): v-icon(color='grey') mdi-compass-off
                    v-list-item-content
                      .caption.grey--text {{$t('tags.emptyList')}}
                  v-list-item(
                    v-for='tag of filteredTags'
                    :key='tag.id'
                    :class='(tag.id === current.id) ? "teal" : ""'
                    @click='selectTag(tag)'
                    )
                    v-list-item-avatar(size='24', tile): v-icon(size='18', :color='tag.id === current.id ? `white` : `teal`') mdi-tag
                    v-list-item-title(:class='tag.id === current.id ? `white--text` : ``') {{tag.tag}}
            v-flex.animated.fadeInUp.wait-p2s
              template(v-if='current.id')
                v-card
                  v-toolbar(dense, color='teal', flat, dark)
                    .subtitle-1 {{$t('tags.edit')}}
                    v-spacer
                    v-btn.pl-4(
                      color='white'
                      dark
                      outlined
                      small
                      :href='`/t/` + current.tag'
                      )
                      span.text-none {{$t('admin:tags.viewLinkedPages')}}
                      v-icon(right) mdi-chevron-right
                  v-card-text
                    v-text-field(
                      outlined
                      :label='$t("tags.tag")'
                      prepend-icon='mdi-tag'
                      v-model='current.tag'
                      counter='255'
                    )
                    v-text-field(
                      outlined
                      :label='$t("tags.label")'
                      prepend-icon='mdi-format-title'
                      v-model='current.title'
                      hide-details
                    )
                  v-card-chin
                    i18next.caption.pl-3(path='admin:tags.date', tag='div')
                      strong(place='created') {{current.createdAt | moment('from')}}
                      strong(place='updated') {{current.updatedAt | moment('from')}}
                    v-spacer
                    v-dialog(v-model='deleteTagDialog', max-width='500')
                      template(v-slot:activator='{ on }')
                        v-btn(color='red', outlined, v-on='on')
                          v-icon(color='red') mdi-trash-can-outline
                      v-card
                        .dialog-header.is-red {{$t('admin:tags.deleteConfirm')}}
                        v-card-text.pa-4
                          i18next(tag='span', path='admin:tags.deleteConfirmText')
                            strong(place='tag') {{ current.tag }}
                        v-card-actions
                          v-spacer
                          v-btn(text, @click='deleteTagDialog = false') {{$t('common:actions.cancel')}}
                          v-btn(color='red', dark, @click='deleteTag(current)') {{$t('common:actions.delete')}}
                    v-btn.px-5.mr-2(color='success', depressed, dark, @click='saveTag(current)')
                      v-icon(left) mdi-content-save
                      span {{$t('common:actions.save')}}
              v-card(v-else)
                v-card-text.grey--text(v-if='tags.length > 0') {{$t('tags.noSelectionText')}}
                v-card-text.grey--text(v-else) {{$t('tags.noItemsText')}}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      tags: [],
      current: {},
      filter: '',
      deleteTagDialog: false
    }
  },
  computed: {
    filteredTags () {
      if (this.filter.length > 0) {
        return _.filter(this.tags, t => t.tag.indexOf(this.filter) >= 0 || t.title.indexOf(this.filter) >= 0)
      } else {
        return this.tags
      }
    }
  },
  methods: {
    selectTag(tag) {
      this.current = tag
    },
    async deleteTag(tag) {
      this.$store.commit(`loadingStart`, 'admin-tags-delete')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              pages {
                deleteTag (id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: tag.id
          }
        })
        if (_.get(resp, 'data.pages.deleteTag.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: this.$t('tags.deleteSuccess'),
            style: 'success',
            icon: 'check'
          })
          this.refresh()
        } else {
          throw new Error(_.get(resp, 'data.pages.deleteTag.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.deleteTagDialog = false
      this.$store.commit(`loadingStop`, 'admin-tags-delete')
    },
    async saveTag(tag) {
      this.$store.commit(`loadingStart`, 'admin-tags-save')
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!, $tag: String!, $title: String!) {
              pages {
                updateTag (id: $id, tag: $tag, title: $title) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: tag.id,
            tag: tag.tag,
            title: tag.title
          }
        })
        if (_.get(resp, 'data.pages.updateTag.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            message: this.$t('tags.saveSuccess'),
            style: 'success',
            icon: 'check'
          })
          this.current.updatedAt = new Date()
        } else {
          throw new Error(_.get(resp, 'data.pages.updateTag.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-tags-save')
    },
    async refresh() {
      await this.$apollo.queries.tags.refetch()
      this.current = {}
      this.$store.commit('showNotification', {
        message: this.$t('tags.refreshSuccess'),
        style: 'success',
        icon: 'cached'
      })
    }
  },
  apollo: {
    tags: {
      query: gql`
        {
          pages {
            tags {
              id
              tag
              title
              createdAt
              updatedAt
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.pages.tags),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-tags-refresh')
      }
    }
  }
}
</script>

<style lang='scss' scoped>

.clickable {
  cursor: pointer;

  &:hover {
    background-color: rgba(mc('blue', '500'), .25);
  }
}

</style>
