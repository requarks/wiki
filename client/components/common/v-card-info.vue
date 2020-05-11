<template lang='pug'>
  .v-card-info(:class='`is-` + color')
    v-card-text.d-flex.align-center(:class='colors.cls')
      v-icon(:color='colors.icon', left) {{icon}}
      slot
</template>

<script>
export default {
  props: {
    color: {
      type: String,
      default: 'blue'
    },
    icon: {
      type: String,
      default: 'mdi-information-outline'
    }
  },
  computed: {
    colors () {
      switch (this.color) {
        case 'blue':
          return {
            cls: this.$vuetify.theme.dark ? 'grey darken-4-l5 blue--text text--lighten-4' : 'blue lighten-5 blue--text text--darken-3',
            icon: 'blue lighten-3'
          }
        case 'red':
          return {
            cls: this.$vuetify.theme.dark ? 'grey darken-4-l5 red--text text--lighten-4' : 'red lighten-5 red--text text--darken-2',
            icon: 'red lighten-3'
          }
        default:
          return {
            cls: this.$vuetify.theme.dark ? 'grey darken-4-l5' : 'grey lighten-4',
            icon: 'grey darken-2'
          }
      }
    }
  }
}
</script>

<style lang="scss">
.v-card-info {
  border-bottom: 1px solid #EEE;

  &.is-blue {
    border-bottom-color: mc('blue', '100');

    @at-root .theme--dark & {
      border-bottom-color: rgba(mc('blue', '100'), .3);
    }
  }

  &.is-red {
    border-bottom-color: mc('red', '100');

    @at-root .theme--dark & {
      border-bottom-color: rgba(mc('red', '100'), .3);
    }
  }
}
</style>
