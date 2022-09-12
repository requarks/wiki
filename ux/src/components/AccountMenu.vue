<template lang='pug'>
q-btn.q-ml-md(flat, round, dense, color='grey')
  q-icon(v-if='!userStore.authenticated || !userStore.pictureUrl', name='las la-user-circle')
  q-avatar(v-else)
    img(:src='userStore.pictureUrl')
  q-menu(auto-close)
    q-card(flat, style='width: 300px;', :dark='false')
      q-card-section(align='center')
        .text-subtitle1.text-grey-7 {{userStore.name}}
        .text-caption.text-grey-8 {{userStore.email}}
      q-separator(:dark='false')
      q-card-actions(align='center')
        q-btn(
          flat
          label='Profile'
          icon='las la-user-alt'
          color='primary'
          to='/_profile'
          no-caps
          )
        q-btn(flat
          label='Logout'
          icon='las la-sign-out-alt'
          color='red'
          href='/logout'
          no-caps
          )
  q-tooltip Account
</template>

<script setup>
import { useUserStore } from 'src/stores/user'

const userStore = useUserStore()
</script>
