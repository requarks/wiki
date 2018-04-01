<template lang="pug">
  .criterias-item
    //- Type
    v-select(solo, :items='filteredCriteriaTypes', v-model='item.type', placeholder='Rule Type', ref='typeSelect')
      template(slot='item', slot-scope='data')
        v-list-tile-avatar
          v-avatar(:color='data.item.color', size='40', tile): v-icon(color='white') {{ data.item.icon }}
        v-list-tile-content
          v-list-tile-title(v-html='data.item.text')
          v-list-tile-sub-title.caption(v-html='data.item.description')

    //- Operator
    v-select(solo, :items='filteredCriteriaOperators', v-model='item.operator', placeholder='Operator', :disabled='!item.type', :class='!item.type ? "blue-grey lighten-4" : ""')
      template(slot='item', slot-scope='data')
        v-list-tile-avatar
          v-avatar.white--text(color='blue', size='30', tile) {{ data.item.icon }}
        v-list-tile-content
          v-list-tile-title(v-html='data.item.text')

    //- Value
    v-select(v-if='item.type === "country"', solo, :items='countries', v-model='item.value', placeholder='Countries...', multiple, item-text='name', item-value='code')
    v-text-field(v-else-if='item.type === "path"', solo, v-model='item.value', label='Path (e.g. /section)')
    v-text-field(v-else-if='item.type === "date"', solo, @click.native.stop='dateActivator = true', v-model='item.value', label='YYYY-MM-DD', readonly)
    v-text-field(v-else-if='item.type === "time"', solo, @click.native.stop='timeActivator = true', v-model='item.value', label='HH:MM', readonly)
    v-select(v-else-if='item.type === "group"', solo, :items='groups', v-model='item.value', placeholder='Group...', item-text='name', item-value='id')
    v-text-field.blue-grey.lighten-4(v-else, solo, disabled)

    v-dialog(lazy, v-model='dateActivator', width='290px', ref='dateDialog')
      v-date-picker(v-model='item.value', scrollable, color='primary')
        v-btn(flat, color='primary' @click='$refs.dateDialog.save(date)', block) ok

    v-dialog(lazy, v-model='timeActivator', width='300px', ref='timeDialog')
      v-time-picker(v-model='item.value', scrollable, color='primary')
        v-btn(flat, color='primary' @click='$refs.timeDialog.save(time)', block) ok

    v-btn(icon, @click='remove'): v-icon(color='blue-grey') clear
</template>

<script>
import _ from 'lodash'

// import countriesQuery from 'gql/upsells-query-countries.gql'

export default {
  inject: ['allowedCriteriaTypes'],
  props: {
    value: {
      type: Object,
      default() { return {} }
    },
    groupIndex: {
      type: Number,
      default() { return 0 }
    },
    itemIndex: {
      type: Number,
      default() { return 0 }
    }
  },
  data() {
    return {
      item: {
        operator: '',
        type: '',
        value: ''
      },
      dateActivator: false,
      dateDialog: false,
      timeActivator: false,
      timeDialog: false,
      countries: [],
      groups: [],
      criteriaTypes: [
        { text: 'Path', value: 'path', icon: 'space_bar', color: 'blue', description: 'Match the path of the document being viewed.' },
        { text: 'Date', value: 'date', icon: 'date_range', color: 'blue', description: 'Match the current calendar day.' },
        { text: 'Time', value: 'time', icon: 'access_time', color: 'blue', description: 'Match the current time of day.' },
        { text: 'User Country', value: 'country', icon: 'public', color: 'red', description: `Match the user's country.` },
        { text: 'User Group', value: 'group', icon: 'group', color: 'orange', description: 'Match the user group assignments.' }
      ],
      criteriaOperators: {
        country: [
          { text: 'In', value: 'in', icon: '[...]' },
          { text: 'Not In', value: 'notIn', icon: '[ x ]' }
        ],
        path: [
          { text: 'Matches Exactly', value: 'eq', icon: '=' },
          { text: 'NOT Matches Exactly', value: 'ne', icon: '!=' },
          { text: 'Starts With', value: 'sw', icon: 'x...' },
          { text: 'NOT Starts With', value: 'nsw', icon: '!x...' },
          { text: 'Ends With', value: 'ew', icon: '...x' },
          { text: 'NOT Ends With', value: 'new', icon: '!...x' },
          { text: 'Matches Regex', value: 'regexp', icon: '^x$' }
        ],
        date: [
          { text: 'On or After', value: 'gte', icon: '>=' },
          { text: 'On or Before', value: 'lte', icon: '<=' }
        ],
        time: [
          { text: 'At or Later Than', value: 'gte', icon: '>=' },
          { text: 'At or Before', value: 'lte', icon: '<=' }
        ],
        group: [
          { text: 'Is Part Of', value: 'in', icon: '[...]' },
          { text: 'Is Not Part Of', value: 'notIn', icon: '[ x ]' }
        ]
      }
    }
  },
  computed: {
    filteredCriteriaOperators() {
      return _.get(this.criteriaOperators, this.item.type, [])
    },
    filteredCriteriaTypes() {
      console.info(this.allowedCriteriaTypes)
      return _.filter(this.criteriaTypes, c => _.includes(this.allowedCriteriaTypes, c.value))
    },
    itemType() {
      return this.item.type
    }
  },
  watch: {
    itemType(newValue, oldValue) {
      this.item.operator = _.head(this.criteriaOperators[newValue]).value
      this.item.value = ''
    },
    item: {
      handler(newValue, oldValue) {
        this.$emit('update', this.groupIndex, this.itemIndex, this.item)
      },
      deep: true
    }
  },
  mounted() {
    if (!this.item.type) {
      this.$refs.typeSelect.showMenu()
    }
  },
  methods: {
    remove() {
      this.$emit('remove', this.groupIndex, this.itemIndex)
    }
  }
  // apollo: {
  //   countries: {
  //     query: countriesQuery,
  //     update: (data) => data.location.countries
  //   }
  // }
}
</script>
