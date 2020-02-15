<template lang="pug">
  v-card
    v-card-text(v-if='group.id === 1')
      v-alert.radius-7(
        :class='$vuetify.theme.dark ? "grey darken-4" : "orange lighten-5"'
        color='orange darken-2'
        outlined
        icon='mdi-lock-outline'
        ) This group has access to everything.
    template(v-else)
      v-card-title(:class='$vuetify.theme.dark ? `grey darken-3-d5` : ``')
        v-alert.radius-7.caption(
          :class='$vuetify.theme.dark ? `grey darken-3-d3` : `grey lighten-4`'
          color='grey'
          outlined
          icon='mdi-information'
          ) You must enable global content permissions (under Permissions tab) for page rules to have any effect.
        v-spacer
        v-btn.mx-2(depressed, color='primary', @click='addRule')
          v-icon(left) mdi-plus
          | Add Rule
        v-menu(
          right
          offset-y
          nudge-left='115'
          )
          template(v-slot:activator='{ on }')
            v-btn.is-icon(v-on='on', outlined, color='primary')
              v-icon mdi-dots-horizontal
          v-list(dense)
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-application-import
              v-list-item-title Load Preset
            v-divider
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-application-export
              v-list-item-title Save As Preset
            v-divider
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-cloud-upload
              v-list-item-title Import Rules
            v-divider
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-cloud-download
              v-list-item-title Export Rules
      v-card-text(:class='$vuetify.theme.dark ? `grey darken-4-l5` : `white`')
        .rules
          .caption(v-if='group.pageRules.length === 0')
            em(:class='$vuetify.theme.dark ? `grey--text` : `blue-grey--text`') This group has no page rules yet.
          .rule(v-for='rule of group.pageRules', :key='rule.id')
            v-btn.ma-0.radius-4.rule-deny-btn(
              solo
              :color='rule.deny ? "red" : "green"'
              dark
              @click='rule.deny = !rule.deny'
              height='48'
              )
              v-icon(v-if='rule.deny') mdi-cancel
              v-icon(v-else) mdi-check-circle
            //- Roles
            v-select.ml-1(
              solo
              :items='roles'
              v-model='rule.roles'
              placeholder='Select Role(s)...'
              hide-details
              multiple
              chips
              deletable-chips
              small-chips
              height='48px'
              style='flex: 0 1 440px;'
              :menu-props='{ "maxHeight": 500 }'
              clearable
              dense
              )
              template(slot='selection', slot-scope='{ item, index }')
                v-chip.white--text.ml-0(v-if='index <= 1', small, label, :color='rule.deny ? `red` : `green`').caption {{ item.value }}
                v-chip.white--text.ml-0(v-if='index === 2', small, label, :color='rule.deny ? `red lighten-2` : `green lighten-2`').caption + {{ rule.roles.length - 2 }} more
              template(slot='item', slot-scope='props')
                v-list-item-action(style='min-width: 30px;')
                  v-checkbox(
                    v-model='props.attrs.inputValue'
                    hide-details
                    color='primary'
                  )
                v-icon.mr-2(:color='rule.deny ? `red` : `green`') {{props.item.icon}}
                v-list-item-content
                  v-list-item-title.body-2 {{props.item.text}}
                v-chip.mr-2.grey--text(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`').caption {{props.item.value}}

            //- Match
            v-select.ml-1.mr-1(
              solo
              :items='matches'
              v-model='rule.match'
              placeholder='Match...'
              hide-details
              height='48px'
              style='flex: 0 1 250px;'
              dense
              )
              template(slot='selection', slot-scope='{ item, index }')
                .body-2 {{item.text}}
              template(slot='item', slot-scope='data')
                v-list-item-avatar
                  v-avatar.white--text.radius-4(color='blue', size='30', tile) {{ data.item.icon }}
                v-list-item-content
                  v-list-item-title(v-html='data.item.text')
            //- Locales
            v-select.mr-1(
              :background-color='$vuetify.theme.dark ? `grey darken-3-d5` : `blue-grey lighten-5`'
              solo
              :items='locales'
              v-model='rule.locales'
              placeholder='Any Locale'
              multiple
              hide-details
              height='48px'
              dense
              :menu-props='{ "minWidth": 250 }'
              style='flex: 0 1 150px;'
              )
              template(slot='selection', slot-scope='{ item, index }')
                v-chip.white--text.ml-0(v-if='rule.locales.length === 1', small, label, :color='rule.deny ? `red` : `green`').caption {{ item.value.toUpperCase() }}
                v-chip.white--text.ml-0(v-else-if='index === 0', small, label, :color='rule.deny ? `red` : `green`').caption {{ rule.locales.length }} locales
              v-list-item(slot='prepend-item', @click='rule.locales = []')
                v-list-item-action(style='min-width: 30px;')
                  v-checkbox(
                    :input-value='rule.locales.length === 0'
                    hide-details
                    color='primary'
                    readonly
                  )
                v-icon.mr-2(:color='rule.deny ? `red` : `green`') mdi-earth
                v-list-item-content
                  v-list-item-title.body-2 Any Locale
              v-divider(slot='prepend-item')
              template(slot='item', slot-scope='props')
                v-list-item-action(style='min-width: 30px;')
                  v-checkbox(
                    v-model='props.attrs.inputValue'
                    hide-details
                    color='primary'
                  )
                v-icon.mr-2(:color='rule.deny ? `red` : `green`') mdi-web
                v-list-item-content
                  v-list-item-title.body-2 {{props.item.text}}
                v-chip.mr-2.grey--text(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`').caption {{props.item.value.toUpperCase()}}

            //- Path
            v-text-field(
              solo
              v-model='rule.path'
              label='Path'
              :prefix='(rule.match !== `END` && rule.match !== `TAG`) ? `/` : null'
              :placeholder='rule.match === `REGEX` ? `Regular Expression` : rule.match === `TAG` ? `Tag` : `Path`'
              :suffix='rule.match === `REGEX` ? `/` : null'
              hide-details
              :color='$vuetify.theme.dark ? `grey` : `blue-grey`'
              )

            v-btn.ml-2(icon, @click='removeRule(rule.id)', small)
              v-icon(:color='$vuetify.theme.dark ? `grey` : `blue-grey`') mdi-close

        v-divider.mt-3
        .overline.py-3 Rules Order
        .body-2.pl-3 Rules are applied in order of path specificity. A more precise path will always override a less defined path.
        .body-2.pl-5 For example, #[span.teal--text /geography/countries] will override #[span.teal--text /geography].
        .body-2.pl-3.pt-2 When 2 rules have the same specificity, the priority is given from lowest to highest as follows:
        .body-2.pl-3.pt-1
          ul
            li
              strong Path Starts With...
              em.caption.pl-1 (lowest)
            li
              strong Path Ends With...
            li
              strong Path Matches Regex...
            li
              strong Tag Matches...
            li
              strong Path Is Exactly...
              em.caption.pl-1 (highest)
        .body-2.pl-3.pt-2 When 2 rules have the same path specificity AND the same match type, #[strong.red--text DENY] will always override an #[strong.green--text ALLOW] rule.
        v-divider.mt-3
        .overline.py-3 Regular Expressions
        span Expressions that are deemed unsafe or could result in exponential time processing will be rejected upon saving.

</template>

<script>
import _ from 'lodash'
import nanoid from 'nanoid/non-secure/generate'

export default {
  props: {
    value: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      roles: [
        { text: 'Read Pages', value: 'read:pages', icon: 'mdi-file-document-box-search-outline' },
        { text: 'Create Pages', value: 'write:pages', icon: 'mdi-file-document-box-plus-outline' },
        { text: 'Edit + Move Pages', value: 'manage:pages', icon: 'mdi-file-document-edit-outline' },
        { text: 'Delete Pages', value: 'delete:pages', icon: 'mdi-file-document-box-remove-outline' },
        { text: 'View Pages Source', value: 'read:source', icon: 'mdi-code-tags' },
        { text: 'View Pages History', value: 'read:history', icon: 'mdi-history' },
        { text: 'Read / Use Assets', value: 'read:assets', icon: 'mdi-image-search-outline' },
        { text: 'Upload Assets', value: 'write:assets', icon: 'mdi-image-plus' },
        { text: 'Edit + Delete Assets', value: 'manage:assets', icon: 'mdi-image-size-select-large' },
        { text: 'Read Comments', value: 'read:comments', icon: 'mdi-comment-search-outline' },
        { text: 'Create Comments', value: 'write:comments', icon: 'mdi-comment-plus-outline' },
        { text: 'Edit + Delete Comments', value: 'manage:comments', icon: 'mdi-comment-remove-outline' }
      ],
      matches: [
        { text: 'Path Starts With...', value: 'START', icon: '/...' },
        { text: 'Path is Exactly...', value: 'EXACT', icon: '=' },
        { text: 'Path Ends With...', value: 'END', icon: '.../' },
        { text: 'Path Matches Regex...', value: 'REGEX', icon: '$.*' },
        { text: 'Tag Matches...', value: 'TAG', icon: 'T' }
      ],
      locales: [
        { text: 'English', value: 'en' }
      ]
    }
  },
  computed: {
    group: {
      get() { return this.value },
      set(val) { this.$set('input', val) }
    }
  },
  methods: {
    addRule(group) {
      this.group.pageRules.push({
        id: nanoid('1234567890abcdef', 10),
        path: '',
        roles: [],
        match: 'START',
        deny: false,
        locales: []
      })
    },
    removeRule(ruleId) {
      this.group.pageRules.splice(_.findIndex(this.group.pageRules, ['id', ruleId]), 1)
    },
    comingSoon() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    },
    dude (stuff) {
      console.info(stuff)
    }
  }
}
</script>

<style lang="scss">
.rules {
  background-color: mc('blue-grey', '50');
  border-radius: 4px;
  padding: 1rem;
  position: relative;

  @at-root .v-application.theme--dark & {
    background-color: mc('grey', '800');
  }
}

.rule {
  display: flex;
  background-color: mc('blue-grey', '100');
  border-radius: 4px;
  padding: .5rem;
  align-items: center;

  &-enter-active, &-leave-active {
    transition: all .5s ease;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }

  @at-root .v-application.theme--dark & {
    background-color: mc('grey', '700');
  }

  & + .rule {
    margin-top: .5rem;
    position: relative;

    &::before {
      content: '+';
      position: absolute;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 600;
      color: mc('blue-grey', '700');
      font-size: 1.25rem;
      background-color: mc('blue-grey', '50');
      left: -2rem;
      top: -1.3rem;

      @at-root .v-application.theme--dark & {
        background-color: mc('grey', '800');
        color: mc('grey', '600');
      }
    }
  }

  .input-group + * {
    margin-left: .5rem;
  }
}
</style>
