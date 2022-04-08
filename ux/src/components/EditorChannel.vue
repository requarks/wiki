<template lang="pug">
.channel-container
  .channel-sidebar
    q-card.rounded-borders.bg-dark
      q-list(
        padding
        dark
        )
        q-item(
          v-for='ch of channels'
          :key='ch.id'
          active-class='bg-primary text-white'
          :active='selectedChannel === ch.id'
          @click='selectedChannel = ch.id'
          clickable
          )
          q-item-section(side)
            q-icon(name='las la-grip-lines')
          q-item-section
            q-item-label
              span #&nbsp;
              strong {{ch.name}}
            q-item-label(caption) {{ch.description}}
          //- q-item-section(side)
          //-   q-badge(color='accent', label='0')
    q-btn.q-mt-sm.full-width(
      color='primary'
      icon='las la-plus'
      :label='$t(`Add Channel`)'
      no-caps
      )
  .channel-main
</template>

<script>

export default {
  data () {
    return {
      selectedChannel: 'xyz',
      channels: [
        {
          id: 'xyz',
          name: 'general',
          description: 'General discussions super long stuff'
        },
        {
          id: 'yas',
          name: 'random',
          description: 'Unrelated / fun stuff'
        },
        {
          id: 'asd',
          name: 'devs',
          description: 'Developer only'
        }
      ]
    }
  }
}
</script>

<style lang="scss">
.channel {
  &-container {
    display: flex;
    height: 100%;
  }

  &-sidebar {
    width: 300px;
    flex: 0 0 300px;
    padding: 16px;
  }

  &-main {
    background-color: #FFF;
    flex: 1;
  }
}
</style>
