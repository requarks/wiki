<template lang='pug'>
q-btn.q-ml-md(flat, round, dense, color='grey')
  q-icon(v-if='!user.picture', name='las la-user-circle')
  q-avatar(v-else)
    img(:src='user.picture')
  q-menu(auto-close)
    q-card(flat, style='width: 300px;', :dark='false')
      q-card-section(align='center')
        .text-subtitle1.text-grey-7 {{user.name}}
        .text-caption.text-grey-8 {{user.email}}
      q-separator(:dark='false')
      q-card-actions(align='center')
        q-btn(
          flat
          label='Profile'
          icon='las la-user-alt'
          color='primary'
          to='/p'
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

<script>
export default {
  name: 'AccountMenu',
  data () {
    return {
      user: {
        name: 'John Doe',
        email: 'test@example.com',
        picture: null
      }
    }
  }
}
</script>
