<template lang="pug">
q-card.icon-picker(flat, style='width: 400px;')
  q-tabs.text-primary(
    v-model='currentTab'
    no-caps
    inline-label
    )
    q-tab(
      name='icon'
      icon='las la-icons'
      label='Icon'
      )
    q-tab(
      name='img'
      icon='las la-image'
      label='Image'
      )
  q-separator
  q-tab-panels(
    v-model='currentTab'
    )
    q-tab-panel(name='icon')
      q-select(
        :options='iconPacks'
        v-model='selPack'
        emit-value
        map-options
        outlined
        dense
        transition-show='jump-down'
        transition-hide='jump-up'
        )
        template(v-slot:option='scope')
          q-item(
            v-bind='scope.itemProps'
            v-on='scope.itemEvents'
            :class='scope.selected ? `bg-primary text-white` : ``'
            )
            q-item-section(side)
              q-icon(
                name='las la-box'
                :color='scope.selected ? `white` : `grey`'
              )
            q-item-section
              q-item-label {{scope.opt.name}}
              q-item-label(caption): strong(:class='scope.selected ? `text-white` : `text-primary`') {{scope.opt.subset}}
            q-item-section(side, v-if='scope.opt.subset')
              q-chip(
                color='primary'
                text-color='white'
                rounded
                size='sm'
              ) {{scope.opt.subset.toUpperCase()}}
      q-input.q-mt-md(
        v-model='selIcon'
        outlined
        label='Icon Name'
        dense
      )
      .row.q-gutter-md.q-mt-none
        .col-auto
          q-avatar(
            size='64px'
            color='primary'
            rounded
            )
            q-icon(
              :name='iconName'
              color='white'
              size='64px'
            )
        .col
          .text-caption Learn how to #[a(href='https://docs.requarks.io') use icons].
          .text-caption.q-mt-sm View #[a(:href='iconPackRefWebsite', target='_blank') Icon Pack reference] for all possible options.
    q-tab-panel(name='img')
      .row.q-gutter-sm
        q-btn.col(
          label='Browse...'
          color='secondary'
          icon='las la-file-image'
          unelevated
          no-caps
        )
        q-btn.col(
          label='Upload...'
          color='secondary'
          icon='las la-upload'
          unelevated
          no-caps
        )
      .q-mt-md.text-center
        q-avatar(
          size='64px'
          rounded
          )
          q-img(
            transition='jump-down'
            :ratio='1'
            :src='imgPath'
          )
  q-separator
  q-card-actions
    q-space
    q-btn(
      icon='las la-times'
      label='Discard'
      outline
      color='grey-7'
      v-close-popup
    )
    q-btn(
      icon='las la-check'
      label='Apply'
      unelevated
      color='secondary'
      @click='apply'
      v-close-popup
    )
</template>

<script>
import find from 'lodash/find'

export default {
  props: {
    value: {
      type: String,
      required: true
    }
  },
  data () {
    return {
      currentTab: 'icon',
      selPack: 'las',
      selIcon: '',
      imgPath: 'https://placeimg.com/64/64/nature',
      iconPacks: [
        { value: 'las', label: 'Line Awesome (solid)', name: 'Line Awesome', subset: 'solid', prefix: 'las la-', reference: 'https://icons8.com/line-awesome' },
        { value: 'lab', label: 'Line Awesome (brands)', name: 'Line Awesome', subset: 'brands', prefix: 'lab la-', reference: 'https://icons8.com/line-awesome' },
        { value: 'mdi', label: 'Material Design Icons', name: 'Material Design Icons', prefix: 'mdi-', reference: 'https://materialdesignicons.com' },
        { value: 'fas', label: 'Font Awesome (solid)', name: 'Font Awesome', subset: 'solid', prefix: 'fas fa-', reference: 'https://fontawesome.com/icons' },
        { value: 'far', label: 'Font Awesome (regular)', name: 'Font Awesome', subset: 'regular', prefix: 'far fa-', reference: 'https://fontawesome.com/icons' },
        { value: 'fal', label: 'Font Awesome (light)', name: 'Font Awesome', subset: 'light', prefix: 'fal fa-', reference: 'https://fontawesome.com/icons' },
        { value: 'fad', label: 'Font Awesome (duotone)', name: 'Font Awesome', subset: 'duotone', prefix: 'fad fa-', reference: 'https://fontawesome.com/icons' },
        { value: 'fab', label: 'Font Awesome (brands)', name: 'Font Awesome', subset: 'brands', prefix: 'fab fa-', reference: 'https://fontawesome.com/icons' }
      ]
    }
  },
  computed: {
    iconName () {
      return find(this.iconPacks, ['value', this.selPack]).prefix + this.selIcon
    },
    iconPackRefWebsite () {
      return find(this.iconPacks, ['value', this.selPack]).reference
    }
  },
  mounted () {
    if (this.value?.startsWith('img:')) {
      this.currentTab = 'img'
      this.imgPath = this.value.substring(4)
    } else {
      this.currentTab = 'icon'
      for (const pack of this.iconPacks) {
        if (this.value?.startsWith(pack.prefix)) {
          this.selPack = pack.value
          this.selIcon = this.value.substring(pack.prefix.length)
          break
        }
      }
    }
  },
  methods: {
    apply () {
      if (this.currentTab === 'img') {
        this.$emit('input', `img:${this.imgPath}`)
      } else {
        this.$emit('input', this.iconName)
      }
    }
  }
}
</script>

<style lang="scss">
.icon-picker {
  a {
    @at-root .body--light & {
      color: $blue-7;
    }
    @at-root .body--dark & {
      color: $blue-3;
    }
  }

  .q-tab-panels {
    @at-root .body--light & {
      background-color: $grey-1;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
    }
  }

  .q-input .q-field__control, .q-select .q-field__control {
    @at-root .body--light & {
      background-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: $dark-5;
    }
  }
}
</style>
