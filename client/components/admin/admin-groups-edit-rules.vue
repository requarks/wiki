<template lang="pug">
  v-card(flat)
    v-card-text(v-if='group.id === 1')
      v-alert.radius-7.mb-0(
        :class='$vuetify.theme.dark ? "grey darken-4" : "orange lighten-5"'
        color='orange darken-2'
        outlined
        icon='mdi-lock-outline'
        ) {{$t('admin:groups.administrator')}}
    template(v-else)
      v-card-title(:class='$vuetify.theme.dark ? `grey darken-3-d5` : ``')
        v-alert.radius-7.caption(
          :class='$vuetify.theme.dark ? `grey darken-3-d3` : `grey lighten-4`'
          color='grey'
          outlined
          icon='mdi-information'
          ) {{$t('admin:groups.pageRuleAlert')}}
        v-spacer
        v-btn.mx-2(depressed, color='primary', @click='addRule')
          v-icon(left) mdi-plus
          | {{$t('admin:groups.addRule')}}
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
              v-list-item-title {{$t('admin:groups.loadPreset')}}
            v-divider
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-application-export
              v-list-item-title {{$t('admin:groups.saveAsPreset')}}
            v-divider
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-cloud-upload
              v-list-item-title {{$t('admin:groups.importRules')}}
            v-divider
            v-list-item(@click='comingSoon')
              v-list-item-avatar
                v-icon mdi-cloud-download
              v-list-item-title {{$t('admin:groups.exportRules')}}
      v-card-text(:class='$vuetify.theme.dark ? `grey darken-4-l5` : `white`')
        .rules
          .caption(v-if='group.pageRules.length === 0')
            em(:class='$vuetify.theme.dark ? `grey--text` : `blue-grey--text`') {{$t('admin:groups.noRules')}}
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
              v-bind:placeholder="$t('admin:groups.selectRoles')"
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
                v-chip.white--text.ml-0(v-if='index === 2', small, label, :color='rule.deny ? `red lighten-2` : `green lighten-2`').caption + {{ rule.roles.length - 2 }} {{$t('admin:groups.ruleMore')}}
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
              v-bind:placeholder="$t('admin:groups.ruleLocales')"
              item-value='code'
              item-text='name'
              multiple
              hide-details
              height='48px'
              dense
              :menu-props='{ "minWidth": 250 }'
              style='flex: 0 1 150px;'
              )
              template(slot='selection', slot-scope='{ item, index }')
                v-chip.white--text.ml-0(v-if='rule.locales.length === 1', small, label, :color='rule.deny ? `red` : `green`').caption {{ item.code.toUpperCase() }}
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
                  v-list-item-title.body-2 {{props.item.name}}
                v-chip.mr-2.grey--text(label, small, :color='$vuetify.theme.dark ? `grey darken-4` : `grey lighten-4`').caption {{props.item.code.toUpperCase()}}

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
        .overline.py-3 {{$t('admin:groups.ruleOrderTitle')}}
        .body-2.pl-3 {{$t('admin:groups.ruleOrderPath')}}
        .body-2.pl-5 {{$t('admin:groups.ruleOrderPathExample')}}
        .body-2.pl-3.pt-2 {{$t('admin:groups.ruleOrderPriorityTitle')}}
        .body-2.pl-3.pt-1
          ul
            li
              strong {{$t('admin:groups.ruleMatchPathStart')}}
              em.caption.pl-1 (lowest)
            li
              strong {{$t('admin:groups.ruleMatchPathEnds')}}
            li
              strong {{$t('admin:groups.ruleMatchPathRegex')}}
            li
              strong {{$t('admin:groups.ruleMatchTag')}}
            li
              strong {{$t('admin:groups.ruleMatchPathExactly')}}
              em.caption.pl-1 (highest)
        .body-2.pl-3.pt-2 {{$t('admin:groups.ruleOrderOverride')}}
        v-divider.mt-3
        .overline.py-3 {{$t('admin:groups.ruleRegularExpressions')}}
        span {{$t('admin:groups.ruleRegularExpressionsHint')}}

</template>

<script>
import _ from 'lodash'
import { customAlphabet } from 'nanoid/non-secure'

/* global siteLangs */

const nanoid = customAlphabet('1234567890abcdef', 10)

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
        { text: this.$t('admin:permission.readPages'), value: 'read:pages', icon: 'mdi-file-eye-outline' },
        { text: this.$t('admin:permission.writePages'), value: 'write:pages', icon: 'mdi-file-plus-outline' },
        { text: this.$t('admin:permission.managePages'), value: 'manage:pages', icon: 'mdi-file-document-edit-outline' },
        { text: this.$t('admin:permission.deletePages'), value: 'delete:pages', icon: 'mdi-file-remove-outline' },
        { text: this.$t('admin:permission.readSource'), value: 'read:source', icon: 'mdi-code-tags' },
        { text: this.$t('admin:permission.readHistory'), value: 'read:history', icon: 'mdi-history' },
        { text: this.$t('admin:permission.readAssets'), value: 'read:assets', icon: 'mdi-image-search-outline' },
        { text: this.$t('admin:permission.writeAssets'), value: 'write:assets', icon: 'mdi-image-plus' },
        { text: this.$t('admin:permission.manageAssets'), value: 'manage:assets', icon: 'mdi-image-size-select-large' },
        { text: this.$t('admin:permission.readComments'), value: 'read:comments', icon: 'mdi-comment-search-outline' },
        { text: this.$t('admin:permission.writeComments'), value: 'write:comments', icon: 'mdi-comment-plus-outline' },
        { text: this.$t('admin:permission.manageComments'), value: 'manage:comments', icon: 'mdi-comment-remove-outline' }
      ],
      matches: [
        { text: this.$t('admin:groups.ruleMatchPathStart'), value: 'START', icon: '/...' },
        { text: this.$t('admin:groups.ruleMatchPathExactly'), value: 'EXACT', icon: '=' },
        { text: this.$t('admin:groups.ruleMatchPathEnds'), value: 'END', icon: '.../' },
        { text: this.$t('admin:groups.ruleMatchPathRegex'), value: 'REGEX', icon: '$.*' },
        { text: this.$t('admin:groups.ruleMatchTag'), value: 'TAG', icon: 'T' }
      ]
    }
  },
  computed: {
    group: {
      get() { return this.value },
      set(val) { this.$set('input', val) }
    },
    locales() { return siteLangs }
  },
  methods: {
    addRule(group) {
      this.group.pageRules.push({
        id: nanoid(),
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
