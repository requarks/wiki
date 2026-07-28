<template>
  <div class="channel-container">
    <div class="channel-sidebar">
      <w-card class="rounded bg-dark">
        <w-list padding dark>
          <w-item
            v-for="ch of channels"
            :key="ch.id"
            active-class="bg-primary text-white"
            :active="selectedChannel === ch.id"
            @click="selectedChannel = ch.id"
            clickable>
            <w-item-section side><w-icon name="la:grip-lines" /></w-item-section>
            <w-item-section>
              <w-item-label><span>#&nbsp;</span><strong>{{ch.name}}</strong></w-item-label>
              <w-item-label caption>{{ch.description}}</w-item-label>
            </w-item-section>
            <!-- q-item-section(side) -->
            <!-- q-badge(color='accent', label='0') -->
          </w-item>
        </w-list>
      </w-card>
      <w-btn
        class="mt-2 w-full"
        color="primary"
        icon="la:plus"
        :label="$t(`Add Channel`)"
        no-caps />
    </div>
    <div class="channel-main" />
  </div>
</template>

<script>
export default {
  data() {
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
    background-color: #fff;
    flex: 1;
  }
}
</style>
