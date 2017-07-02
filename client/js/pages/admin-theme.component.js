'use strict'

export default {
  name: 'admin-theme',
  props: ['themedata'],
  data() {
    return {
      primary: 'indigo',
      alt: 'blue-grey',
      footer: 'blue-grey',
      codedark: 'true',
      codecolorize: 'true'
    }
  },
  watch: {
    primary(val) {
      this.$root.changeTheme(this.$data)
    },
    alt(val) {
      this.$root.changeTheme(this.$data)
    },
    footer(val) {
      this.$root.changeTheme(this.$data)
    }
  },
  methods: {
    saveTheme() {
      let self = this
      this.$http.post(window.location.href, self.$data).then(resp => {
        self.$store.dispatch('alert', {
          style: 'green',
          icon: 'check',
          msg: 'Theme settings have been applied successfully.'
        })
      }).catch(err => {
        self.$store.dispatch('alert', {
          style: 'red',
          icon: 'square-cross',
          msg: 'Error: ' + err.body.msg
        })
      })
    },
    resetTheme() {
      this.primary = 'indigo'
      this.alt = 'blue-grey'
      this.footer = 'blue-grey'
      this.codedark = 'true'
      this.codecolorize = 'true'
    }
  },
  mounted() {
    let theme = JSON.parse(this.themedata)
    this.primary = theme.primary
    this.alt = theme.alt
    this.footer = theme.footer
    this.codedark = theme.code.dark.toString()
    this.codecolorize = theme.code.colorize.toString()
  }
}
