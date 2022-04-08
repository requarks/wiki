<template lang="pug">
q-dialog(ref='dialog', @hide='onDialogHide')
  q-card(style='min-width: 850px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-down.svg', left, size='sm')
      span {{$t(`admin.locale.downloadTitle`)}}
    q-card-section.q-pa-none
      q-table.no-border-radius(
        :data='locales'
        :columns='headers'
        row-name='code'
        flat
        hide-bottom
        :rows-per-page-options='[0]'
        :loading='loading > 0'
        )
        template(v-slot:body-cell-code='props')
          q-td(:props='props')
            q-chip(
              square
              color='teal'
              text-color='white'
              dense
              ): span.text-caption {{props.value}}
        template(v-slot:body-cell-name='props')
          q-td(:props='props')
            strong {{props.value}}
        template(v-slot:body-cell-isRTL='props')
          q-td(:props='props')
            q-icon(
              v-if='props.value'
              name='las la-check'
              color='brown'
              size='xs'
              )
        template(v-slot:body-cell-availability='props')
          q-td(:props='props')
            q-circular-progress(
              size='md'
              show-value
              :value='props.value'
              :thickness='0.1'
              :color='props.value <= 33 ? `negative` : (props.value <= 66) ? `warning` : `positive`'
            ) {{ props.value }}%
        template(v-slot:body-cell-isInstalled='props')
          q-td(:props='props')
            q-spinner(
              v-if='props.row.isDownloading'
              color='primary'
              size='20px'
              :thickness='2'
              )
            q-btn(
              v-else-if='props.value && props.row.installDate < props.row.updatedAt'
              flat
              round
              dense
              @click='download(props.row)'
              icon='las la-redo-alt'
              color='accent'
              )
            q-btn(
              v-else-if='props.value'
              flat
              round
              dense
              @click='download(props.row)'
              icon='las la-check-circle'
              color='positive'
              )
            q-btn(
              v-else
              flat
              round
              dense
              @click='download(props.row)'
              icon='las la-cloud-download-alt'
              color='primary'
              )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='$t(`common.actions.close`)'
        color='grey'
        padding='xs md'
        @click='hide'
        )

    q-inner-loading(:showing='loading')
      q-spinner(color='accent', size='lg')
</template>

<script>
// import gql from 'graphql-tag'
// import cloneDeep from 'lodash/cloneDeep'

export default {
  emits: ['ok', 'hide'],
  data () {
    return {
      locales: [],
      loading: 0
    }
  },
  computed: {
    headers () {
      return [
        {
          label: this.$t('admin.locale.code'),
          align: 'left',
          field: 'code',
          name: 'code',
          sortable: true,
          style: 'width: 90px'
        },
        {
          label: this.$t('admin.locale.name'),
          align: 'left',
          field: 'name',
          name: 'name',
          sortable: true
        },
        {
          label: this.$t('admin.locale.nativeName'),
          align: 'left',
          field: 'nativeName',
          name: 'nativeName',
          sortable: true
        },
        {
          label: this.$t('admin.locale.rtl'),
          align: 'center',
          field: 'isRTL',
          name: 'isRTL',
          sortable: false,
          style: 'width: 10px'
        },
        {
          label: this.$t('admin.locale.availability'),
          align: 'center',
          field: 'availability',
          name: 'availability',
          sortable: false,
          style: 'width: 120px'
        },
        {
          label: this.$t('admin.locale.download'),
          align: 'center',
          field: 'isInstalled',
          name: 'isInstalled',
          sortable: false,
          style: 'width: 100px'
        }
      ]
    }
  },
  methods: {
    show () {
      this.$refs.dialog.show()
    },
    hide () {
      this.$refs.dialog.hide()
    },
    onDialogHide () {
      this.$emit('hide')
    }
  }
}
</script>
