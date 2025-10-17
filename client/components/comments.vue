<template lang="pug">
  div(v-intersect.once='onIntersect')
    mentionable(:keys="mentionableKeys", :items="users", @open="loadUsers($event)" , @apply="handleApply")
      v-textarea#discussion-new(
        ref="newCommentTextarea"
        outlined
        flat
        :placeholder='$t(`common:comments.newPlaceholder`)'
        auto-grow
        dense
        rows='3'
        hide-details
        v-model='newcomment'
        color='indigo darken-1'
        :background-color='$vuetify.theme.dark ? `indigo darken-1` : `white`'
        v-if='permissions.write'
        :aria-label='$t(`common:comments.fieldContent`)'
      )
      template( v-if='loading' #no-result) {{ 'Loading...'}}

    v-row.mt-2(dense, v-if='!isAuthenticated && permissions.write')
      v-col(cols='12', lg='6')
        v-text-field(
          outlined
          color='blue-grey darken-2'
          :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
          :placeholder='$t(`common:comments.fieldName`)'
          hide-details
          dense
          autocomplete='name'
          v-model='guestName'
          :aria-label='$t(`common:comments.fieldName`)'
        )
      v-col(cols='12', lg='6')
        v-text-field(
          outlined
          color='blue-grey darken-2'
          :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
          :placeholder='$t(`common:comments.fieldEmail`)'
          hide-details
          type='email'
          dense
          autocomplete='email'
          v-model='guestEmail'
          :aria-label='$t(`common:comments.fieldEmail`)'
        )
    .d-flex.align-center.pt-3(v-if='permissions.write')
      v-icon.mr-1(color='grey lighten-1') mdi-language-markdown-outline
      .caption.grey-lighten--text {{$t('common:comments.markdownFormat')}}
      v-spacer
      .caption.mr-3.grey--text(v-if='isAuthenticated')
        strong
          span {{ $t('common:comments.postingAs') || 'Posting As' }}
        | {{userDisplayName}}
      v-btn.rounded-button(
        dark
        :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
        @click='postComment'
        depressed
        :aria-label='$t(`common:comments.postComment`)'
        )
        span.text-none {{$t('common:comments.postComment')}}
    v-divider.mt-3(v-if='permissions.write')
    .pa-5.d-flex.align-center.justify-center(v-if='isLoading && !hasLoadedOnce')
      v-progress-circular(
        indeterminate
        size='20'
        width='1'
        color='blue-grey'
      )
      .caption.blue-grey--text.pl-3: em {{$t('common:comments.loading')}}
    v-timeline(
      dense
      v-else-if='comments && comments.length > 0'
      )
      v-timeline-item.comments-post(
        color='indigo darken-1'
        large
        v-for='cm of comments'
        :key='`comment-` + cm.id'
        :id='`comment-post-id-` + cm.id'
        )
        template(v-slot:icon)
          v-avatar(:color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy')
            //- v-img(src='http://i.pravatar.cc/64')
            span.white--text.title {{cm.initials}}
        v-card.elevation-1
          v-card-text
            .comments-post-actions(v-if='canManageComment(cm) && !isBusy && commentEditId === 0')
              v-icon.mr-3(small, @click='editComment(cm)') mdi-pencil
              v-icon(small, @click='deleteCommentConfirm(cm)') mdi-delete
            .comments-post-name.caption.author-name: strong {{cm.authorName}}
            .comments-post-date.overline.grey--text {{cm.createdAt | moment('from') }} #[em(v-if='cm.createdAt !== cm.updatedAt') - {{$t('common:comments.modified', { reldate: $options.filters.moment(cm.updatedAt, 'from') })}}]
            .comments-post-content.mt-3(v-if='commentEditId !== cm.id', v-html='cm.render')
            .comments-post-editcontent.mt-3(v-else)
              mentionable(:keys="mentionableKeys", :items="users", @open="loadUsers($event)", @apply="handleApply")
                v-textarea(
                  ref="editCommentTextarea"
                  outlined
                  flat
                  auto-grow
                  dense
                  rows='3'
                  hide-details
                  v-model='commentEditContent'
                  color='blue-grey darken-2'
                  :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
                )
                .d-flex.align-center.pt-3
                v-spacer
                v-btn.mr-3(
                  dark
                  :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite : colors.surfaceLight.primarySapHeavy'
                  @click='editCommentCancel'
                  outlined
                  )
                  v-icon(left, :color='$vuetify.theme.dark ? colors.surfaceLight.primaryNeutralLite :colors.surfaceLight.inverse') mdi-close
                  span.text-none {{$t('common:actions.cancel')}}
                v-btn(
                  dark
                  :color='$vuetify.theme.dark ? colors.surfaceDark.secondarySapHeavy : colors.surfaceLight.secondaryBlueHeavy'
                  @click='updateComment'
                  depressed
                  )
                  span.text-none {{$t('common:comments.updateComment')}}
    .pt-5.text-center.body-2.blue-grey--text(v-else-if='permissions.write') {{$t('common:comments.beFirst')}}
    .text-center.body-2.blue-grey--text(v-else) {{$t('common:comments.none')}}

    v-dialog(v-model='deleteCommentDialogShown', max-width='500')
      v-card
        .dialog-header.is-red {{$t('common:comments.deleteConfirmTitle')}}
        v-card-text.pt-5
          span {{$t('common:comments.deleteWarn')}}
          .caption: strong {{$t('common:comments.deletePermanentWarn')}}
        v-card-chin
          v-spacer
          v-btn(text, @click='deleteCommentDialogShown = false') {{$t('common:actions.cancel')}}
          v-btn(color='red', dark, @click='deleteComment') {{$t('common:actions.delete')}}
</template>

<script>
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'
import validate from 'validate.js'
import _ from 'lodash'
import { Mentionable } from 'vue-mention'
import 'floating-vue/dist/style.css'
import colors from '@/themes/default/js/color-scheme'
import autoCompleteEmailsQuery from '../graph/editor/users-query-auto-complete.gql'

export default {
  components: {
    Mentionable
  },
  data() {
    return {
      colors,
      newcomment: '',
      isLoading: true,
      hasLoadedOnce: false,
      comments: [],
      guestName: '',
      guestEmail: '',
      commentToDelete: {},
      commentEditId: 0,
      commentEditContent: null,
      deleteCommentDialogShown: false,
      isBusy: false,
      mentions: [],
      users: [],
      scrollOpts: {
        duration: 1500,
        offset: 0,
        easing: 'easeInOutCubic'
      },
      // @a @b @c ... @A @B @C ...
      mentionableKeys: [
        ...Array.from({ length: 26 }, (_, i) => `@${String.fromCharCode(97 + i)}`), // lowercase letters
        ...Array.from({ length: 26 }, (_, i) => `@${String.fromCharCode(65 + i)}`) // uppercase letters
      ],
      loading: false
    }
  },
  computed: {
    pageId: get('page/id'),
    permissions: get('page/effectivePermissions@comments'),
    hasSuperAdminPermission: get('page/effectivePermissions@system.manage'),
    isAuthenticated: get('user/authenticated'),
    userDisplayName: get('user/name'),
    userId: get('user/id'),
    siteId: get('page/siteId'),
    sitePath: get('page/sitePath')
  },
  methods: {
    async loadUsers(searchText) {
      this.fetchUsers(searchText.slice(1))
    },
    handleApply(item) {
      const textarea = this.commentEditId === 0 ?
        this.$refs.newCommentTextarea.$el.querySelector('textarea') :
        this.$refs.editCommentTextarea[0].$el.querySelector('textarea')

      let commentContent = this.commentEditId === 0 ? this.newcomment : this.commentEditContent

      if (textarea) {
        const mentionText = `@${item.email.slice(0, 1)}${item.email}`
        const lowerCaseCommentContent = commentContent.toLowerCase()
        const lowerCaseMentionText = mentionText.toLowerCase()
        const mentionPos = lowerCaseCommentContent.indexOf(lowerCaseMentionText)

        if (mentionPos === -1) {
          console.error('Mention text not found in comment content')
          return
        }
        // If the mention text is found, replace it with the new mention
        const beforeMention = commentContent.slice(0, mentionPos)
        let afterMention = commentContent.slice(mentionPos + mentionText.length)
        // Add a space if the character immediately following the mention is not a space
        if (afterMention.length > 0 && afterMention[0] !== ' ') {
          afterMention = ' ' + afterMention
        }
        commentContent = beforeMention + `@${item.email}` + afterMention
        if (this.commentEditId === 0) {
          this.newcomment = commentContent
        } else {
          this.commentEditContent = commentContent
        }

        this.mentions.push(item.email)
        this.$nextTick(() => {
          textarea.selectionStart = textarea.selectionEnd = commentContent.length // Adjust cursor position
        })
      }
    },
    onIntersect(entries, observer, isIntersecting) {
      if (isIntersecting) {
        this.fetch(true)
      }
    },
    async fetch(silent = false) {
      this.isLoading = true
      try {
        const results = await this.$apollo.query({
          query: gql`
            query ($locale: String!, $path: String!, $siteId: String!) {
                listComments(locale: $locale, path: $path, siteId: $siteId) {
                  id
                  render
                  authorName
                  authorId
                  createdAt
                  updatedAt
                }
              }
          `,
          variables: {
            locale: this.$store.get('page/locale'),
            path: this.$store.get('page/path'),
            siteId: this.siteId
          },
          fetchPolicy: 'network-only'
        })
        this.comments = _.get(results, 'data.listComments', []).map(c => {
          const nameParts = c.authorName.toUpperCase().split(' ')
          let initials = _.head(nameParts).charAt(0)
          if (nameParts.length > 1) {
            initials += _.last(nameParts).charAt(0)
          }
          return {
            ...c,
            initials
          }
        })
      } catch (err) {
        console.warn(err)
        if (!silent) {
          this.$store.commit('showNotification', {
            style: 'red',
            message: err.message,
            icon: 'alert'
          })
        }
      }
      this.isLoading = false
      this.hasLoadedOnce = true
    },
    /**
     * Post New Comment
     */
    async postComment() {
      let rules = {
        comment: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2
          }
        }
      }
      if (!this.isAuthenticated && this.permissions.write) {
        rules.name = {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
        rules.email = {
          presence: {
            allowEmpty: false
          },
          email: true
        }
      }
      const validationResults = validate({
        comment: this.newcomment,
        name: this.guestName,
        email: this.guestEmail
      }, rules, { format: 'flat' })

      if (validationResults) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: validationResults[0],
          icon: 'alert'
        })
        return
      }

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $pageId: Int!
              $replyTo: Int
              $content: String!
              $guestName: String
              $guestEmail: String
              $mentions: [String!]
            ) {
              comments {
                create (
                  pageId: $pageId
                  replyTo: $replyTo
                  content: $content
                  guestName: $guestName
                  guestEmail: $guestEmail
                  mentions: $mentions
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  id
                }
              }
            }
          `,
          variables: {
            pageId: this.pageId,
            replyTo: 0,
            content: this.newcomment,
            guestName: this.guestName,
            guestEmail: this.guestEmail,
            mentions: this.mentions
          }
        })

        if (_.get(resp, 'data.comments.create.responseResult.succeeded', false)) {
          this.mentions = []
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('common:comments.postSuccess'),
            icon: 'check'
          })

          this.newcomment = ''
          await this.fetch()
          this.$nextTick(() => {
            this.$vuetify.goTo(`#comment-post-id-${_.get(resp, 'data.comments.create.id', 0)}`, this.scrollOpts)
          })
        } else {
          throw new Error(_.get(resp, 'data.comments.create.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
    },
    /**
     * Show Comment Editing Form
     */
    async editComment(cm) {
      this.$store.commit(`loadingStart`, 'comments-edit')
      this.isBusy = true
      try {
        const results = await this.$apollo.query({
          query: gql`
            query ($id: Int!) {
                commentById(id: $id) {
                  content
                }
            }
          `,
          variables: {
            id: cm.id
          },
          fetchPolicy: 'network-only'
        })
        this.commentEditContent = _.get(results, 'data.commentById.content', null)
        if (this.commentEditContent === null) {
          throw new Error('Failed to load comment content.')
        }
      } catch (err) {
        console.warn(err)
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.commentEditId = cm.id
      this.isBusy = false
      this.$store.commit(`loadingStop`, 'comments-edit')
    },
    /**
     * Cancel Comment Edit
     */
    editCommentCancel() {
      this.commentEditId = 0
      this.commentEditContent = null
    },
    /**
     * Update Comment with new content
     */
    async updateComment() {
      this.$store.commit(`loadingStart`, 'comments-edit')
      this.isBusy = true
      try {
        if (this.commentEditContent.length < 2) {
          throw new Error(this.$t('common:comments.contentMissingError'))
        }

        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int!
              $content: String!
              $pageId: Int!
              $mentions: [String!]
            ) {
              comments {
                update (
                  id: $id,
                  content: $content
                  pageId: $pageId
                  mentions: $mentions
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                  render
                }
              }
            }
          `,
          variables: {
            id: this.commentEditId,
            content: this.commentEditContent,
            pageId: this.pageId,
            mentions: this.mentions
          }
        })

        if (_.get(resp, 'data.comments.update.responseResult.succeeded', false)) {
          this.mentions = []
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('common:comments.updateSuccess'),
            icon: 'check'
          })

          const cm = _.find(this.comments, ['id', this.commentEditId])
          cm.render = _.get(resp, 'data.comments.update.render', '-- Failed to load updated comment --')
          cm.updatedAt = (new Date()).toISOString()

          this.editCommentCancel()
        } else {
          throw new Error(_.get(resp, 'data.comments.delete.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        console.warn(err)
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.isBusy = false
      this.$store.commit(`loadingStop`, 'comments-edit')
    },
    /**
     * Show Delete Comment Confirmation Dialog
     */
    deleteCommentConfirm(cm) {
      this.commentToDelete = cm
      this.deleteCommentDialogShown = true
    },
    /**
     * Delete Comment
     */
    async deleteComment() {
      this.$store.commit(`loadingStart`, 'comments-delete')
      this.isBusy = true
      this.deleteCommentDialogShown = false

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $id: Int!
            ) {
              comments {
                delete (
                  id: $id
                ) {
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
            id: this.commentToDelete.id
          }
        })

        if (_.get(resp, 'data.comments.delete.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('common:comments.deleteSuccess'),
            icon: 'check'
          })

          this.comments = _.reject(this.comments, ['id', this.commentToDelete.id])
        } else {
          throw new Error(_.get(resp, 'data.comments.delete.responseResult.message', 'An unexpected error occurred.'))
        }
      } catch (err) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: err.message,
          icon: 'alert'
        })
      }
      this.isBusy = false
      this.$store.commit(`loadingStop`, 'comments-delete')
    },
    async fetchUsers(query) {
      this.loading = true
      try {
        const respRaw = await this.$apollo.query({
          query: autoCompleteEmailsQuery,
          variables: {
            siteId: this.$store.get('page/siteId'),
            query: query
          }
        })
        const resp = _.get(respRaw, 'data.autoCompleteEmails', [])
        this.users = resp.map(email => ({
          value: email,
          label: email,
          email: email
        }))
      } catch (err) {
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    canManageComment(cm) {
      if (!this.permissions.manage) return false
      return this.hasSuperAdminPermission || cm.authorId === this.userId
    }
  }
}
</script>

<style lang="scss">
.mention-item {
  padding: 4px 10px;
  border-radius: 4px;
}

.mention-selected {
  background: rgb(0, 191, 191);
}

.mention {
    background-color: rgba(153, 0, 48, .1);
    color: #990030;
}
.author-name {
  color: mc('neutral', '800');

  @at-root .theme--dark & {
    color: mc('neutral', '100');
  }
}
.v-btn.rounded-button {
  border-radius: 20px;
}
.comments-post {
  position: relative;

  &:hover {
    .comments-post-actions {
      opacity: 1;
    }
  }

  &-actions {
    position: absolute;
    top: 16px;
    right: 16px;
    opacity: 0;
    transition: opacity .4s ease;
  }

  &-content {
    > p:first-child {
      padding-top: 0;
    }

    p {
      padding-top: 1rem;
      margin-bottom: 0;
    }

    img {
      max-width: 100%;
      border-radius: 5px;
    }

    code {
      background-color: rgba(mc('red', '600'), .1);
      box-shadow: none;
    }

    pre > code {
      margin-top: 1rem;
      padding: 12px;
      background-color: #111;
      box-shadow: none;
      border-radius: 5px;
      width: 100%;
      color: #FFF;
      font-weight: 400;
      font-size: .85rem;
      font-family: Ubuntu Mono, monospace;
    }
    // ---------------------------------
    // TABLES
    // ---------------------------------

    table {
      margin: .5rem 0;
      border-spacing: 0;
      border-radius: 5px;
      border: 1px solid mc('neutral', '300');

      @at-root .theme--dark & {
        border-color: mc('neutral', '600');
      }

      &.dense {
        td, th {
          font-size: .85rem;
          padding: .5rem;
        }
      }

      th {
        padding: .75rem;
        border-bottom: 2px solid mc('neutral', '500');
        color: mc('neutral', '600');
        background-color: mc('neutral', '100');

        @at-root .theme--dark & {
          background-color: mc('neutral', '900');
          border-bottom-color: mc('neutral', '600');
          color: mc('neutral', '500');
        }

        &:first-child {
          border-top-left-radius: 7px;
        }
        &:last-child {
          border-top-right-radius: 7px;
        }
      }

      td {
        padding: .75rem;
      }

      tr {
        td {
          border-bottom: 1px solid mc('neutral', '300');
          border-right: 1px solid mc('neutral', '100');

          @at-root .theme--dark & {
            border-bottom-color: mc('neutral', '700');
            border-right-color: mc('neutral', '800');
          }

          &:nth-child(even) {
            background-color: mc('neutral', '50');

            @at-root .theme--dark & {
              background-color: mc('neutral', '900');
            }
          }

          &:last-child {
            border-right: none;
          }
        }

        &:nth-child(even) {
          td {
            background-color: mc('neutral', '50');

            @at-root .theme--dark & {
              background-color: mc('neutral', '800');
            }

            &:nth-child(even) {
              background-color: mc('neutral', '100');

              @at-root .theme--dark & {
                background-color: mc('neutral', '800');
              }
            }
          }
        }

        &:last-child {
          td {
            border-bottom: none;

            &:first-child {
              border-bottom-left-radius: 7px;
            }
            &:last-child {
              border-bottom-right-radius: 7px;
            }
          }
        }
      }
    }

  }
}

</style>
