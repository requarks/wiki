<template lang='pug'>
q-page.admin-icons
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.admin-icons-icon.animated.fadeInLeft(src='/_assets/icons/fluent-spring.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.icons.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.icons.subtitle') }}
    .col-auto
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/system/icons`'
        target='_blank'
        type='a'
        )
      q-btn.acrylic-btn.q-mr-sm(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='fa-solid fa-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :disabled='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12
      q-card.shadow-1
        q-card-section
          q-card.bg-negative.text-white.rounded-borders(flat)
            q-card-section.items-center(horizontal)
              q-card-section.col-auto.q-pr-none
                q-icon(name='las la-exclamation-triangle', size='sm')
              q-card-section
                span {{ t('admin.icons.warnLabel') }}
                .text-caption.text-red-1 {{ t('admin.icons.warnHint') }}
        q-list(separator)
          q-item(v-for='pack of combinedPacks', :key='pack.key')
            blueprint-icon(icon='small-icons', :hueRotate='30')
            q-item-section
              q-item-label: strong {{pack.label}}
              q-item-label(caption, v-if='pack.isMandatory')
                em {{t('admin.icons.mandatory')}}
            template(v-if='pack.config')
              q-item-section(
                side
                )
                q-btn(
                  icon='las la-cog'
                  :label='t(`admin.editors.configuration`)'
                  :color='$q.dark.isActive ? `blue-grey-3` : `blue-grey-8`'
                  outline
                  no-caps
                  padding='xs md'
                )
              q-separator.q-ml-md(vertical)
            q-item-section(
              side
              )
              q-btn(
                type='a'
                icon='las la-external-link-square-alt'
                :label='t(`admin.icons.reference`)'
                color='indigo'
                outline
                no-caps
                padding='xs md'
                :href='pack.website'
                target='_blank'
                rel='noreferrer noopener'
              )
            q-separator.q-ml-md(vertical)
            q-item-section(side)
              q-toggle.q-pr-sm(
                :modelValue='pack.isActive'
                @update:model-value='newValue => setPackState(pack.key, newValue)'
                :color='pack.isDisabled ? `grey` : `primary`'
                checked-icon='las la-check'
                unchecked-icon='las la-times'
                :label='t(`admin.sites.isActive`)'
                :aria-label='t(`admin.sites.isActive`)'
                :disabled='pack.isMandatory'
                )

</template>

<script setup>
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.icons.title')
})

// DATA

const state = reactive({
  loading: false,
  config: {
    la: { isActive: true }
  }
})

const packs = [
  {
    key: 'bs',
    label: 'Bootstrap Icons',
    website: 'https://icons.getbootstrap.com'
  },
  {
    key: 'eva',
    label: 'Eva Icons',
    website: 'https://akveo.github.io/eva-icons'
  },
  {
    key: 'fa',
    label: 'Font Awesome',
    website: 'https://fontawesome.com',
    isMandatory: true,
    config: {}
  },
  {
    key: 'io',
    label: 'Ionicons',
    website: 'https://ionic.io/ionicons'
  },
  {
    key: 'la',
    label: 'Line Awesome',
    isMandatory: true,
    website: 'https://icons8.com/line-awesome'
  },
  {
    key: 'mdi',
    label: 'Material Design Icons',
    website: 'https://materialdesignicons.com',
    config: {}
  },
  {
    key: 'thm',
    label: 'Themify Icons',
    website: 'https://themify.me/themify-icons'
  }
]

// COMPUTED

const combinedPacks = computed(() => {
  return packs.map(p => ({
    ...p,
    isActive: (state.config?.[p.key]?.isActive || p.isMandatory) ?? false
  }))
})

// METHODS

async function load () {
  // state.loading++
  // $q.loading.show()
  // const resp = await APOLLO_CLIENT.query({
  //   query: gql`
  //     query fetchExtensions {
  //       systemExtensions {
  //         key
  //         title
  //         description
  //         isInstalled
  //         isInstallable
  //         isCompatible
  //       }
  //     }
  //   `,
  //   fetchPolicy: 'network-only'
  // })
  // state.extensions = cloneDeep(resp?.data?.systemExtensions)
  // $q.loading.hide()
  // state.loading--
}

async function save () {

}

function setPackState (packKey, newValue) {
  state.config[packKey] = {
    ...state.config[packKey] ?? {},
    isActive: newValue
  }
}

// MOUNTED

onMounted(() => {
  load()
})

</script>

<style lang='scss'>
.admin-icons {
  &-icon {
    animation: fadeInLeft .6s forwards, flower-rotate 30s linear infinite;
  }

  &-packlink {
    color: $blue-8;

    &:hover, &:focus {
      color: $blue-4;
    }
  }
}

@keyframes flower-rotate {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
