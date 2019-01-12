<template lang="pug">
  v-card.wiki-form
    v-card-text(v-if='group.id === 1')
      v-alert.radius-7(
        :class='$vuetify.dark ? "grey darken-4" : "orange lighten-5"'
        color='orange darken-2'
        outline
        :value='true'
        icon='lock_outline'
        ) This group has access to everything.
    template(v-else)
      v-card-title(:class='$vuetify.dark ? `grey darken-3-d5` : `grey lighten-5`')
        v-alert.radius-7(
          :class='$vuetify.dark ? `grey darken-3-d3` : `white`'
          :value='true'
          color='grey'
          outline
          icon='info'
          ) You must enable global content permissions (under Permissions tab) for page rules to have any effect.
        v-spacer
        v-btn(depressed, color='primary', @click='addRule')
          v-icon(left) add
          | Add Rule
        v-menu(
          right
          offset-y
          nudge-left='115'
          )
          v-btn.is-icon(slot='activator', flat, outline, color='primary')
            v-icon more_horiz
          v-list(dense)
            v-list-tile(@click='comingSoon')
              v-list-tile-avatar
                v-icon keyboard_capslock
              v-list-tile-title Load Preset
            v-divider
            v-list-tile(@click='comingSoon')
              v-list-tile-avatar
                v-icon publish
              v-list-tile-title Save As Preset
            v-divider
            v-list-tile(@click='comingSoon')
              v-list-tile-avatar
                v-icon cloud_upload
              v-list-tile-title Import Rules
            v-divider
            v-list-tile(@click='comingSoon')
              v-list-tile-avatar
                v-icon cloud_download
              v-list-tile-title Export Rules
      v-card-text(:class='$vuetify.dark ? `grey darken-4-l5` : `white`')
        .rules
          .caption(v-if='group.pageRules.length === 0')
            em(:class='$vuetify.dark ? `grey--text` : `blue-grey--text`') This group has no page rules yet.
          .rule(v-for='rule of group.pageRules', :key='rule.id')
            v-btn.ma-0.rule-deny-btn(
              solo
              :color='rule.deny ? "red" : "green"'
              dark
              @click='rule.deny = !rule.deny'
              )
              v-icon(v-if='rule.deny') block
              v-icon(v-else) check_circle
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
              style='flex: 0 1 440px;'
              :menu-props='{ "maxHeight": 500 }'
              clearable
              dense
              )
              template(slot='selection', slot-scope='{ item, index }')
                v-chip.white--text.ml-0(v-if='index <= 1', small, label, :color='rule.deny ? `red` : `green`').caption {{ item.value }}
                v-chip.white--text.ml-0(v-if='index === 2', small, label, :color='rule.deny ? `red lighten-2` : `green lighten-2`').caption + {{ rule.roles.length - 2 }} more
              template(slot='item', slot-scope='props')
                v-list-tile-action(style='min-width: 30px;')
                  v-checkbox(
                    v-model='props.tile.props.value'
                    hide-details
                    color='primary'
                  )
                v-icon.mr-2(:color='rule.deny ? `red` : `green`') {{props.item.icon}}
                v-list-tile-content
                  v-list-tile-title.body-2 {{props.item.text}}
                v-chip.mr-2.grey--text(label, small, :color='$vuetify.dark ? `grey darken-4` : `grey lighten-4`').caption {{props.item.value}}

            //- Match
            v-select.ml-1.mr-1(
              solo
              :items='matches'
              v-model='rule.match'
              placeholder='Match...'
              hide-details
              style='flex: 0 1 250px;'
              dense
              )
              template(slot='selection', slot-scope='{ item, index }')
                .body-1 {{item.text}}
              template(slot='item', slot-scope='data')
                v-list-tile-avatar
                  v-avatar.white--text.radius-4(color='blue', size='30', tile) {{ data.item.icon }}
                v-list-tile-content
                  v-list-tile-title(v-html='data.item.text')
            //- Locales
            v-select.mr-1(
              :background-color='$vuetify.dark ? `grey darken-3-d5` : `blue-grey lighten-5`'
              solo
              :items='locales'
              v-model='rule.locales'
              placeholder='Any Locale'
              multiple
              hide-details
              dense
              :menu-props='{ "minWidth": 250 }'
              style='flex: 0 1 150px;'
              )
              template(slot='selection', slot-scope='{ item, index }')
                v-chip.white--text.ml-0(v-if='rule.locales.length === 1', small, label, :color='rule.deny ? `red` : `green`').caption {{ item.value.toUpperCase() }}
                v-chip.white--text.ml-0(v-else-if='index === 0', small, label, :color='rule.deny ? `red` : `green`').caption {{ rule.locales.length }} locales
              v-list-tile(slot='prepend-item', @click='rule.locales = []')
                v-list-tile-action(style='min-width: 30px;')
                  v-checkbox(
                    :input-value='rule.locales.length === 0'
                    hide-details
                    color='primary'
                    readonly
                  )
                v-icon.mr-2(:color='rule.deny ? `red` : `green`') public
                v-list-tile-content
                  v-list-tile-title.body-2 Any Locale
              v-divider(slot='prepend-item')
              template(slot='item', slot-scope='props')
                v-list-tile-action(style='min-width: 30px;')
                  v-checkbox(
                    v-model='props.tile.props.value'
                    hide-details
                    color='primary'
                  )
                v-icon.mr-2(:color='rule.deny ? `red` : `green`') language
                v-list-tile-content
                  v-list-tile-title.body-2 {{props.item.text}}
                v-chip.mr-2.grey--text(label, small, :color='$vuetify.dark ? `grey darken-4` : `grey lighten-4`').caption {{props.item.value.toUpperCase()}}

            //- Path
            v-text-field(
              solo
              v-model='rule.path'
              label='Path'
              :prefix='rule.match !== `END` ? `/` : null'
              :placeholder='rule.match === `REGEX` ? `Regular Expression` : `Path`'
              :suffix='rule.match === `REGEX` ? `/` : null'
              hide-details
              :color='$vuetify.dark ? `grey` : `blue-grey`'
              )

            v-btn(icon, @click='removeRule(rule.id)')
              v-icon(:color='$vuetify.dark ? `grey` : `blue-grey`') clear

        v-divider.mt-3
        v-subheader.pl-0 Rules Order
        .body-1.pl-3 Rules are applied in order of path specificity. A more precise path will always override a less defined path.
        .body-1.pl-4 For example, #[span.teal--text /geography/countries] will override #[span.teal--text /geography].
        .body-1.pl-3.pt-2 When 2 rules have the same specificity, the priority is given from lowest to highest as follows:
        .body-1.pl-3.pt-1
          ul
            li
              strong Path Starts With...
              em.caption.pl-1 (lowest)
            li
              strong Path Ends With...
            li
              strong Path Matches Regex...
            li
              strong Path Is Exactly...
              em.caption.pl-1 (highest)
        .body-1.pl-3.pt-2 When 2 rules have the same path specificity AND the same match type, #[strong.red--text DENY] will always override an #[strong.green--text ALLOW] rule.

</template>

<script>
import _ from 'lodash'
import nanoid from 'nanoid/non-secure/generate'

export default {
  props: {
    value: {
      type: Object
    }
  },
  data() {
    return {
      roles: [
        { text: 'Read Pages', value: 'read:pages', icon: 'insert_drive_file' },
        { text: 'Create Pages', value: 'write:pages', icon: 'insert_drive_file' },
        { text: 'Edit + Move Pages', value: 'manage:pages', icon: 'insert_drive_file' },
        { text: 'Delete Pages', value: 'delete:pages', icon: 'insert_drive_file' },
        { text: 'Read / Use Assets', value: 'read:assets', icon: 'camera' },
        { text: 'Upload Assets', value: 'write:assets', icon: 'camera' },
        { text: 'Edit + Delete Assets', value: 'manage:assets', icon: 'camera' },
        { text: 'Read Comments', value: 'read:comments', icon: 'insert_comment' },
        { text: 'Create Comments', value: 'write:comments', icon: 'insert_comment' },
        { text: 'Edit + Delete Comments', value: 'manage:comments', icon: 'insert_comment' }
      ],
      matches: [
        { text: 'Path Starts With...', value: 'START', icon: '/...' },
        { text: 'Path is Exactly...', value: 'EXACT', icon: '=' },
        { text: 'Path Ends With...', value: 'END', icon: '.../' },
        { text: 'Path Matches Regex...', value: 'REGEX', icon: '$.*' }
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
    removeRule(rule) {
      this.group.pageRules.splice(_.findIndex(this.group.pageRules, ['id', rule.id]), 1)
    },
    comingSoon() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
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

  @at-root .theme--dark & {
    background-color: mc('grey', '800');
  }
}

.rule {
  display: flex;
  background-color: mc('blue-grey', '100');
  border-radius: 4px;
  padding: .5rem;

  &-enter-active, &-leave-active {
    transition: all .5s ease;
  }
  &-enter, &-leave-to {
    opacity: 0;
  }

  @at-root .theme--dark & {
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

      @at-root .theme--dark & {
        background-color: mc('grey', '800');
        color: mc('grey', '600');
      }
    }
  }

  .input-group + * {
    margin-left: .5rem;
  }

  &-deny-btn {
    height: 48px;
    border-radius: 2px 0 0 2px;
    min-width: 0;
  }

}
</style>
