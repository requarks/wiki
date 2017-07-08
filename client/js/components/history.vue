<template lang="pug">
  .container.is-fluid
    .columns.is-gapless

      .column.is-narrow.is-hidden-touch.sidebar
        aside.stickyscroll
          .sidebar-label
            span {{ $t('history.pastversions') }}
          ul.sidebar-menu
            li(v-for='item in versions')
              a.is-multiline(:title='item.dateFull', @click='changeCommit(item)', :class='{ "is-active": item.commit === current.commit }')
                span {{ item.dateCalendar }}
                span.is-small {{ item.commitAbbr }}

      .column
        .history
          .history-title {{ currentPath }}
          .history-info
            .columns
              .column.history-info-meta
                p
                  i.nc-icon-outline.ui-1_calendar-check-62
                  span {{ $t('history.timestamp') }}: #[strong {{ current.dateFull }}]
                p
                  i.nc-icon-outline.i.nc-icon-outline.users_man-23
                  span {{ $t('history.author') }}: #[strong {{ current.name }} &lt;{{ current.email }}&gt;]
                p
                  i.nc-icon-outline.media-1_flash-21
                  span {{ $t('history.commit') }}: #[strong {{ current.commit }}]
              .column.history-info-actions
                .button-group
                  button.button.is-blue-grey(@click='compareWith')
                    i.nc-icon-outline.design_path-intersect
                    span {{ $t('history.comparewith') }}
                  button.button.is-blue-grey(@click='view')
                    i.nc-icon-outline.ui-1_eye-17
                    span {{ $t('history.view') }}
                  button.button.is-blue-grey(@click='revertToVersion')
                    i.nc-icon-outline.arrows-4_undo-29
                    span {{ $t('history.reverttoversion') }}
                toggle.is-dark(v-model='sidebyside', :desc='$t("history.sidebyside")')
          .history-diff#diff

</template>

<script>
let diffui
let diffuiIsReady = false
export default {
  name: 'history',
  props: ['currentPath', 'historyData'],
  data() {
    return {
      versions: [],
      current: {},
      diffui: {},
      sidebyside: true
    }
  },
  watch: {
    sidebyside() {
      this.draw()
    }
  },
  methods: {
    compareWith() {
      this.$store.dispatch('alert', {
        style: 'purple',
        icon: 'objects_astronaut',
        msg: 'Sorry, this function is not available. Coming soon!'
      })
    },
    view() {
      this.$store.dispatch('alert', {
        style: 'purple',
        icon: 'objects_astronaut',
        msg: 'Sorry, this function is not available. Coming soon!'
      })
    },
    revertToVersion() {
      this.$store.dispatch('alert', {
        style: 'purple',
        icon: 'objects_astronaut',
        msg: 'Sorry, this function is not available. Coming soon!'
      })
    },
    draw() {
      if (diffuiIsReady) {
        diffui.draw('#diff', {
          inputFormat: 'diff',
          outputFormat: this.sidebyside ? 'side-by-side' : 'line-by-line',
          matching: 'words',
          synchronisedScroll: true
        })
      }
    },
    changeCommit(cm) {
      let self = this
      diffuiIsReady = false
      self.current = cm
      self.$http.post(siteRoot + '/hist', {
        path: self.currentPath,
        commit: cm.commit
      }).then(resp => {
        return resp.json()
      }).then(resp => {
        diffui = new Diff2HtmlUI({ diff: resp.diff })
        diffuiIsReady = true
        self.draw()
      }).catch(err => {
        console.log(err)
        self.$store.dispatch('alert', {
          style: 'red',
          icon: 'ui-2_square-remove-09',
          msg: 'Error: ' + err.body.error
        })
      })
    }
  },
  mounted() {
    this.versions = JSON.parse(this.historyData)
    this.changeCommit(this.versions[0])
  }
}
</script>
