<template lang="pug">
  div(v-intersect.once='onIntersect')
    v-textarea#discussion-new(
      outlined
      flat
      placeholder='Write a new comment...'
      auto-grow
      dense
      rows='3'
      hide-details
      v-model='newcomment'
      color='blue-grey darken-2'
      :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
      v-if='permissions.write'
    )
    v-row.mt-2(dense, v-if='!isAuthenticated && permissions.write')
      v-col(cols='12', lg='6')
        v-text-field(
          outlined
          color='blue-grey darken-2'
          :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
          placeholder='Your Name'
          hide-details
          dense
          autocomplete='name'
          v-model='guestName'
        )
      v-col(cols='12', lg='6')
        v-text-field(
          outlined
          color='blue-grey darken-2'
          :background-color='$vuetify.theme.dark ? `grey darken-5` : `white`'
          placeholder='Your Email Address'
          hide-details
          type='email'
          dense
          autocomplete='email'
          v-model='guestEmail'
        )
    .d-flex.align-center.pt-3(v-if='permissions.write')
      v-icon.mr-1(color='blue-grey') mdi-language-markdown-outline
      .caption.blue-grey--text Markdown Format
      v-spacer
      .caption.mr-3(v-if='isAuthenticated') Posting as #[strong {{userDisplayName}}]
      v-btn(
        dark
        color='blue-grey darken-2'
        @click='postComment'
        depressed
        )
        v-icon(left) mdi-comment
        span.text-none Post Comment
    v-divider.mt-3(v-if='permissions.write')
    .pa-5.d-flex.align-center.justify-center(v-if='isLoading')
      v-progress-circular(
        indeterminate
        size='20'
        width='1'
        color='blue-grey'
      )
      .caption.blue-grey--text.pl-3: em Loading comments...
    v-timeline(
      dense
      v-else-if='comments && comments.length > 0'
      )
      v-timeline-item(
        color='pink darken-4'
        large
        v-for='cm of comments'
        :key='`comment-` + cm.id'
        )
        template(v-slot:icon)
          v-avatar
            v-img(src='http://i.pravatar.cc/64')
        v-card.elevation-1
          v-card-text
            .caption: strong {{cm.authorName}}
            .overline.grey--text 3 minutes ago
            .mt-3 {{cm.render}}
    .pt-5.text-center.body-2.blue-grey--text(v-else-if='permissions.write') Be the first to comment.
    .text-center.body-2.blue-grey--text(v-else) No comments yet.
</template>

<script>
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'
import validate from 'validate.js'
import _ from 'lodash'

export default {
  data () {
    return {
      newcomment: '',
      isLoading: true,
      canFetch: false,
      comments: [],
      guestName: '',
      guestEmail: ''
    }
  },
  computed: {
    pageId: get('page/id'),
    permissions: get('page/commentsPermissions'),
    isAuthenticated: get('user/authenticated'),
    userDisplayName: get('user/name')
  },
  methods: {
    onIntersect (entries, observer, isIntersecting) {
      if (isIntersecting) {
        this.isLoading = true
        this.canFetch = true
      }
    },
    async postComment () {
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

      const resp = await this.$apollo.mutate({
        mutation: gql`
          mutation (
            $pageId: Int!
            $replyTo: Int
            $content: String!
            $guestName: String
            $guestEmail: String
          ) {
            comments {
              create (
                pageId: $pageId
                replyTo: $replyTo
                content: $content
                guestName: $guestName
                guestEmail: $guestEmail
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
          pageId: this.pageId,
          replyTo: 0,
          content: this.newcomment,
          guestName: this.guestName,
          guestEmail: this.guestEmail
        }
      })

      if (_.get(resp, 'data.comments.create.responseResult.succeeded', false)) {
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'New comment posted successfully.',
          icon: 'check'
        })

        this.newcomment = ''
      } else {
        this.$store.commit('showNotification', {
          style: 'red',
          message: _.get(resp, 'data.comments.create.responseResult.message', 'An unexpected error occured.'),
          icon: 'alert'
        })
      }
    }
  },
  apollo: {
    comments: {
      query: gql`
        query ($pageId: Int!) {
          comments {
            list(pageId: $pageId) {
              id
              render
              authorName
              createdAt
              updatedAt
            }
          }
        }
      `,
      variables() {
        return {
          pageId: this.pageId
        }
      },
      skip () {
        return !this.canFetch
      },
      fetchPolicy: 'cache-and-network',
      update: (data) => data.comments.list,
      watchLoading (isLoading) {
        this.isLoading = isLoading
      }
    }
  }
}
</script>

<style lang="scss">

</style>
