<template lang="pug">
  .criterias
    transition-group(name='criterias-group', tag='div')
      .criterias-group(v-for='(group, g) in groups', :key='g')
        transition-group(name='criterias-item', tag='div')
          criterias-item(v-for='(item, i) in group', :key='i', :item='item', :group-index='g', :item-index='i', @update='updateItem', @remove='removeItem')
        .criterias-item-more
          v-btn.ml-0(@click='addItem(group)', small, color='blue-grey lighten-2', dark, depressed)
            v-icon(color='white', left) add
            | Add condition
    .criterias-group-more
      v-btn(@click='addGroup', small, color='blue-grey lighten-1', dark, depressed)
        v-icon(color='white', left) add
        | Add condition group
</template>

<script>
import CriteriasItem from './criterias-item.vue'

export default {
  components: {
    CriteriasItem
  },
  props: {
    value: {
      type: Array,
      default() { return [] }
    },
    types: {
      type: Array,
      default() {
        return ['country', 'path', 'date', 'time', 'group']
      }
    }
  },
  provide () {
    return {
      allowedCriteriaTypes: this.types
    }
  },
  data() {
    return {
      dataGroups: this.value || []
    }
  },
  computed: {
    groups: {
      get() { return this.dataGroups },
      set(grp) {
        this.dataGroups = grp
      }
    }
  },
  watch: {
    dataGroups(newValue, oldValue) {
      if (newValue !== oldValue) {
        this.$emit('input', newValue)
      }
    }
  },
  methods: {
    addGroup() {
      this.dataGroups.push([{}])
    },
    addItem(group) {
      group.push({})
    },
    updateItem(groupIndex, itemIndex, item) {
      console.info(item)
      this.$set(this.dataGroups[groupIndex], itemIndex, item)
    },
    removeItem(groupIndex, itemIndex) {
      this.dataGroups[groupIndex].splice(itemIndex, 1)
      if (this.dataGroups[groupIndex].length < 1) {
        this.dataGroups.splice(groupIndex, 1)
      }
    }
  }
}
</script>

<style lang="scss">
.criterias {
  &-group {
    background-color: mc('blue-grey', '100');
    border-radius: 4px;
    padding: 1rem;
    position: relative;

    &-enter-active, &-leave-active {
      transition: all .5s ease;
    }
    &-enter, &-leave-to {
      opacity: 0;
    }

    & + .criterias-group {
      margin-top: 1rem;

      &::before {
        content: 'OR';
        position: absolute;
        display: inline-flex;
        padding: 0 2rem;
        top: -1.25rem;
        left: 2rem;
        background-color: mc('blue-grey', '100');
        color: mc('blue-grey', '700');
        font-weight: 600;
        font-size: .9rem;
      }
    }

    &-more {
      margin: .5rem 0 0 .4rem;
    }
  }

  &-item {
    display: flex;
    background-color: mc('blue-grey', '200');
    border-radius: 4px;
    padding: .5rem;

    &-enter-active, &-leave-active {
      transition: all .5s ease;
    }
    &-enter, &-leave-to {
      opacity: 0;
    }

    & + .criterias-item {
      margin-top: .5rem;
      position: relative;

      &::before {
        content: 'AND';
        position: absolute;
        width: 2rem;
        height: 2rem;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        font-weight: 600;
        color: mc('blue-grey', '700');
        font-size: .7rem;
        background-color: mc('blue-grey', '100');
        left: -2rem;
        top: -1.3rem;
      }
    }

    .input-group {
      &:nth-child(1) {
        flex: 0 1 350px;
      }

      &:nth-child(2) {
        flex: 0 1 250px;
      }

      & + * {
        margin-left: .5rem;
      }
    }

    &-more {
      margin-top: .15rem;
    }
  }
}
</style>
