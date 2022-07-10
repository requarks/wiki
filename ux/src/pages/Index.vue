<template lang='pug'>
q-page.column
  .page-breadcrumbs.q-py-sm.q-px-md.row
    .col
      q-breadcrumbs(
        active-color='grey-7'
        separator-color='grey'
        )
        template(v-slot:separator)
          q-icon(
            name='las la-angle-right'
          )
        q-breadcrumbs-el(icon='las la-home', to='/', aria-label='Home')
          q-tooltip Home
        q-breadcrumbs-el(
          v-for='brd of breadcrumbs'
          :key='brd.id'
          :icon='brd.icon'
          :label='brd.title'
          :aria-label='brd.title'
          :to='$pageHelpers.getFullPath(brd)'
          )
        q-breadcrumbs-el(
          v-if='editCreateMode'
          :icon='pageIcon'
          :label='title || `Untitled Page`'
          :aria-label='title || `Untitled Page`'
          )
    .col-auto.flex.items-center.justify-end
      template(v-if='!isPublished')
        .text-caption.text-accent: strong Unpublished
        q-separator.q-mx-sm(vertical)
      .text-caption.text-grey-6(v-if='editCreateMode') New Page
      .text-caption.text-grey-6(v-if='!editCreateMode') Last modified on #[strong September 5th, 2020]
  .page-header.row
    //- PAGE ICON
    .col-auto.q-pl-md.flex.items-center(v-if='editMode')
      q-btn.rounded-borders(
        padding='none'
        size='37px'
        :icon='pageIcon'
        color='primary'
        flat
        )
        q-menu(content-class='shadow-7')
          icon-picker-dialog(v-model='pageIcon')
    .col-auto.q-pl-md.flex.items-center(v-else)
      q-icon.rounded-borders(
        :name='pageIcon'
        size='64px'
        color='primary'
      )
    //- PAGE HEADER
    .col.q-pa-md(v-if='editMode')
      q-input.no-height(
        borderless
        v-model='title'
        input-class='text-h4 text-grey-9'
        input-style='padding: 0;'
        placeholder='Untitled Page'
        hide-hint
        )
      q-input.no-height(
        borderless
        v-model='description'
        input-class='text-subtitle2 text-grey-7'
        input-style='padding: 0;'
        placeholder='Enter a short description'
        hide-hint
        )
    .col.q-pa-md(v-else)
      .text-h4.page-header-title {{title}}
      .text-subtitle2.page-header-subtitle {{description}}

    //- PAGE ACTIONS
    .col-auto.q-pa-md.flex.items-center.justify-end(v-if='editMode')
      q-btn.q-mr-sm.acrylic-btn(
        flat
        icon='las la-times'
        color='grey-7'
        label='Discard'
        aria-label='Discard'
        no-caps
        @click='mode = `view`'
      )
      q-btn(
        v-if='editorMode === `edit`'
        unelevated
        icon='las la-check'
        color='secondary'
        label='Save'
        aria-label='Save'
        no-caps
        @click='mode = `view`'
      )
      q-btn(
        v-else
        unelevated
        icon='las la-check'
        color='secondary'
        label='Create'
        aria-label='Create'
        no-caps
        @click='mode = `view`'
      )
    .col-auto.q-pa-md.flex.items-center.justify-end(v-else)
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-bell'
        color='grey'
        aria-label='Watch Page'
        )
        q-tooltip Watch Page
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-bookmark'
        color='grey'
        aria-label='Bookmark Page'
        )
        q-tooltip Bookmark Page
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-share-alt'
        color='grey'
        aria-label='Share'
        )
        q-tooltip Share
        social-sharing-menu
      q-btn.q-mr-md(
        flat
        dense
        icon='las la-print'
        color='grey'
        aria-label='Print'
        )
        q-tooltip Print
      q-btn.acrylic-btn(
        flat
        icon='las la-edit'
        color='deep-orange-9'
        label='Edit'
        aria-label='Edit'
        no-caps
        @click='mode = `edit`'
      )
  .page-container.row.no-wrap.items-stretch(style='flex: 1 1 100%;')
    .col(style='order: 1;')
      q-no-ssr(v-if='editMode')
        component(:is='editorComponent')
        //- editor-wysiwyg
        //- editor-markdown
      q-scroll-area(
        :thumb-style='thumbStyle'
        :bar-style='barStyle'
        style='height: 100%;'
        v-else
        )
        .q-pa-md
          div(v-html='render')
          template(v-if='relations && relations.length > 0')
            q-separator.q-my-lg
            .row.align-center
              .col.text-left(v-if='relationsLeft.length > 0')
                q-btn.q-mr-sm.q-mb-sm(
                  padding='sm md'
                  outline
                  :icon='rel.icon'
                  no-caps
                  color='primary'
                  v-for='rel of relationsLeft'
                  :key='`rel-id-` + rel.id'
                  )
                  .column.text-left.q-pl-md
                    .text-body2: strong {{rel.label}}
                    .text-caption {{rel.caption}}
              .col.text-center(v-if='relationsCenter.length > 0')
                .column
                  q-btn(
                    :label='rel.label'
                    color='primary'
                    flat
                    no-caps
                    :icon='rel.icon'
                    v-for='rel of relationsCenter'
                    :key='`rel-id-` + rel.id'
                  )
              .col.text-right(v-if='relationsRight.length > 0')
                q-btn.q-ml-sm.q-mb-sm(
                  padding='sm md'
                  outline
                  :icon-right='rel.icon'
                  no-caps
                  color='primary'
                  v-for='rel of relationsRight'
                  :key='`rel-id-` + rel.id'
                  )
                  .column.text-left.q-pr-md
                    .text-body2: strong {{rel.label}}
                    .text-caption {{rel.caption}}
    .page-sidebar(
      v-if='showSidebar'
      style='order: 2;'
      )
      template(v-if='showToc')
        //- TOC
        .q-pa-md.flex.items-center
          q-icon.q-mr-sm(name='las la-stream', color='grey')
          .text-caption.text-grey-7 Contents
        .q-px-md.q-pb-sm
          q-tree(
            :nodes='toc'
            node-key='key'
            v-model:expanded='tocExpanded'
            v-model:selected='tocSelected'
          )
      //- Tags
      template(v-if='showTags')
        q-separator(v-if='showToc')
        .q-pa-md(
          @mouseover='showTagsEditBtn = true'
          @mouseleave='showTagsEditBtn = false'
          )
          .flex.items-center
            q-icon.q-mr-sm(name='las la-tags', color='grey')
            .text-caption.text-grey-7 Tags
            q-space
            transition(name='fade')
              q-btn(
                v-show='showTagsEditBtn'
                size='sm'
                padding='none xs'
                icon='las la-pen'
                color='deep-orange-9'
                flat
                label='Edit'
                no-caps
                @click='tagEditMode = !tagEditMode'
              )
          page-tags.q-mt-sm(:edit='tagEditMode')
      template(v-if='allowRatings && ratingsMode !== `off`')
        q-separator(v-if='showToc || showTags')
        //- Rating
        .q-pa-md.flex.items-center
          q-icon.q-mr-sm(name='las la-star-half-alt', color='grey')
          .text-caption.text-grey-7 Rate this page
        .q-px-md
          q-rating(
            v-if='ratingsMode === `stars`'
            v-model='currentRating'
            icon='las la-star'
            color='secondary'
            size='sm'
          )
          .flex.items-center(v-else-if='ratingsMode === `thumbs`')
            q-btn.acrylic-btn(
              flat
              icon='las la-thumbs-down'
              color='secondary'
            )
            q-btn.acrylic-btn.q-ml-sm(
              flat
              icon='las la-thumbs-up'
              color='secondary'
            )
    .page-actions.column.items-stretch.order-last
      q-btn.q-py-md(
        flat
        icon='las la-pen-nib'
        color='deep-orange-9'
        aria-label='Page Properties'
        @click='togglePageProperties'
        )
        q-tooltip(anchor='center left' self='center right') Page Properties
      q-btn.q-py-md(
        flat
        icon='las la-project-diagram'
        color='deep-orange-9'
        aria-label='Page Data'
        @click='togglePageData'
        )
        q-tooltip(anchor='center left' self='center right') Page Data
      q-separator.q-my-sm(inset)
      q-btn.q-py-sm(
        flat
        icon='las la-history'
        color='grey'
        aria-label='Page History'
        )
        q-tooltip(anchor='center left' self='center right') Page History
      q-btn.q-py-sm(
        flat
        icon='las la-code'
        color='grey'
        aria-label='Page Source'
        )
        q-tooltip(anchor='center left' self='center right') Page Source
      q-btn.q-py-sm(
        flat
        icon='las la-ellipsis-h'
        color='grey'
        aria-label='Page Actions'
        )
        q-menu(
          anchor='top left'
          self='top right'
          auto-close
          transition-show='jump-left'
          )
          q-list(padding, style='min-width: 225px;')
            q-item(clickable)
              q-item-section.items-center(avatar)
                q-icon(color='deep-orange-9', name='las la-atom', size='sm')
              q-item-section
                q-item-label Convert Page
            q-item(clickable)
              q-item-section.items-center(avatar)
                q-icon(color='deep-orange-9', name='las la-magic', size='sm')
              q-item-section
                q-item-label Re-render Page
            q-item(clickable)
              q-item-section.items-center(avatar)
                q-icon(color='deep-orange-9', name='las la-sun', size='sm')
              q-item-section
                q-item-label View Backlinks
      q-space
      q-btn.q-py-sm(
        flat
        icon='las la-copy'
        color='grey'
        aria-label='Duplicate Page'
        )
        q-tooltip(anchor='center left' self='center right') Duplicate Page
      q-btn.q-py-sm(
        flat
        icon='las la-share'
        color='grey'
        aria-label='Rename / Move Page'
        )
        q-tooltip(anchor='center left' self='center right') Rename / Move Page
      q-btn.q-py-sm(
        flat
        icon='las la-trash'
        color='grey'
        aria-label='Delete Page'
        @click='savePage'
        )
        q-tooltip(anchor='center left' self='center right') Delete Page

  q-dialog(
    v-model='showSideDialog'
    position='right'
    full-height
    transition-show='jump-left'
    transition-hide='jump-right'
    class='floating-sidepanel'
    )
    component(:is='sideDialogComponent')

  q-dialog(
    v-model='showGlobalDialog'
    transition-show='jump-up'
    transition-hide='jump-down'
    )
    component(:is='globalDialogComponent')
</template>

<script>
import { get, sync } from 'vuex-pathify'
import IconPickerDialog from '../components/IconPickerDialog.vue'
import SocialSharingMenu from '../components/SocialSharingMenu.vue'
import PageDataDialog from '../components/PageDataDialog.vue'
import PageTags from '../components/PageTags.vue'
import PagePropertiesDialog from '../components/PagePropertiesDialog.vue'
import PageSaveDialog from '../components/PageSaveDialog.vue'
import EditorWysiwyg from '../components/EditorWysiwyg.vue'

export default {
  name: 'PageIndex',
  components: {
    EditorWysiwyg,
    IconPickerDialog,
    PageDataDialog,
    PagePropertiesDialog,
    PageSaveDialog,
    PageTags,
    SocialSharingMenu
  },
  data () {
    return {
      showSideDialog: false,
      sideDialogComponent: null,
      showGlobalDialog: false,
      globalDialogComponent: null,
      showTagsEditBtn: false,
      tagEditMode: false,
      toc: [
        {
          key: 'h1-0',
          label: 'Introduction'
        },
        {
          key: 'h1-1',
          label: 'Planets',
          children: [
            {
              key: 'h2-0',
              label: 'Earth',
              children: [
                {
                  key: 'h3-0',
                  label: 'Countries',
                  children: [
                    {
                      key: 'h4-0',
                      label: 'Cities',
                      children: [
                        {
                          key: 'h5-0',
                          label: 'Montreal',
                          children: [
                            {
                              key: 'h6-0',
                              label: 'Districts'
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              key: 'h2-1',
              label: 'Mars'
            },
            {
              key: 'h2-2',
              label: 'Jupiter'
            }
          ]
        }
      ],
      tocExpanded: ['h1-0', 'h1-1'],
      tocSelected: [],
      currentRating: 3,
      thumbStyle: {
        right: '2px',
        borderRadius: '5px',
        backgroundColor: '#000',
        width: '5px',
        opacity: 0.15
      },
      barStyle: {
        backgroundColor: '#FAFAFA',
        width: '9px',
        opacity: 1
      }
    }
  },
  computed: {
    mode: sync('page/mode', false),
    editorMode: get('page/editorMode', false),
    breadcrumbs: get('page/breadcrumbs', false),
    title: sync('page/title', false),
    description: sync('page/description', false),
    relations: get('page/relations', false),
    tags: sync('page/tags', false),
    ratingsMode: get('site/ratingsMode', false),
    allowComments: get('page/allowComments', false),
    allowContributions: get('page/allowContributions', false),
    allowRatings: get('page/allowRatings', false),
    showSidebar () {
      return this.$store.get('page/showSidebar') && this.$store.get('site/showSidebar')
    },
    showTags: get('page/showTags', false),
    showToc: get('page/showToc', false),
    tocDepth: get('page/tocDepth', false),
    isPublished: get('page/isPublished', false),
    pageIcon: sync('page/icon', false),
    render: get('page/render', false),
    editorComponent () {
      return this.$store.get('page/editor') ? `editor-${this.$store.get('page/editor')}` : null
    },
    relationsLeft () {
      return this.relations ? this.relations.filter(r => r.position === 'left') : []
    },
    relationsCenter () {
      return this.relations ? this.relations.filter(r => r.position === 'center') : []
    },
    relationsRight () {
      return this.relations ? this.relations.filter(r => r.position === 'right') : []
    },
    editMode () {
      return this.mode === 'edit'
    },
    editCreateMode () {
      return this.mode === 'edit' && this.editorMode === 'create'
    }
  },
  watch: {
    toc () {
      this.refreshTocExpanded()
    },
    tocDepth () {
      this.refreshTocExpanded()
    }
  },
  mounted () {
    this.refreshTocExpanded()
  },
  methods: {
    togglePageProperties () {
      this.sideDialogComponent = 'PagePropertiesDialog'
      this.showSideDialog = true
    },
    togglePageData () {
      this.sideDialogComponent = 'PageDataDialog'
      this.showSideDialog = true
    },
    savePage () {
      this.globalDialogComponent = 'PageSaveDialog'
      this.showGlobalDialog = true
    },
    refreshTocExpanded (baseToc) {
      const toExpand = []
      let isRootNode = false
      if (!baseToc) {
        baseToc = this.toc
        isRootNode = true
      }
      if (baseToc.length > 0) {
        for (const node of baseToc) {
          if (node.key >= `h${this.tocDepth.min}` && node.key <= `h${this.tocDepth.max}`) {
            toExpand.push(node.key)
          }
          if (node.children?.length && node.key < `h${this.tocDepth.max}`) {
            toExpand.push(...this.refreshTocExpanded(node.children))
          }
        }
      }
      if (isRootNode) {
        this.tocExpanded = toExpand
      } else {
        return toExpand
      }
    }
  }
}
</script>

<style lang="scss">
.page-breadcrumbs {
  @at-root .body--light & {
    background: linear-gradient(to bottom, $grey-1 0%, $grey-3 100%);
    border-bottom: 1px solid $grey-4;
  }
  @at-root .body--dark & {
    background: linear-gradient(to bottom, $dark-3 0%, $dark-4 100%);
    border-bottom: 1px solid $dark-3;
  }
}
.page-header {
  @at-root .body--light & {
    background: linear-gradient(to bottom, $grey-2 0%, $grey-1 100%);
    border-bottom: 1px solid $grey-4;
    border-top: 1px solid #FFF;
  }
  @at-root .body--dark & {
    background: linear-gradient(to bottom, $dark-4 0%, $dark-3 100%);
    // border-bottom: 1px solid $dark-5;
    border-top: 1px solid $dark-6;
  }

  .no-height .q-field__control {
    height: auto;
  }

  &-title {
    @at-root .body--light & {
      color: $grey-9;
    }
    @at-root .body--dark & {
      color: #FFF;
    }
  }
  &-subtitle {
    @at-root .body--light & {
      color: $grey-7;
    }
    @at-root .body--dark & {
      color: rgba(255,255,255,.6);
    }
  }
}
.page-container {
  @at-root .body--light & {
    border-top: 1px solid #FFF;
  }
  // @at-root .body--dark & {
  //   border-top: 1px solid $dark-6;
  // }
}
.page-sidebar {
  flex: 0 0 300px;

  @at-root .body--light & {
    background-color: $grey-2;
  }
  @at-root .body--dark & {
    background-color: $dark-5;
  }

  .q-separator {
    background-color: rgba(0,0,0,.05);
    border-bottom: 1px solid;

    @at-root .body--light & {
      background-color: rgba(0,0,0,.05);
      border-bottom-color: #FFF;
    }
    @at-root .body--dark & {
      background-color: rgba(255,255,255,.04);
      border-bottom-color: #070a0d;
    }
  }
}
.page-actions {
  flex: 0 0 56px;

  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-4;
  }
}

.floating-syncpanel {
  .q-dialog__inner {
    margin-top: 14px;
    right: 140px;
    left: auto;

    .q-card {
      border-radius: 17px;
    }
  }

  &-msg {
    padding-top: 1px;
    font-weight: 500;
    font-size: .75rem;
    padding-right: 16px;
    display: flex;
    align-items: center;
  }
}

.floating-sidepanel {
  .q-dialog__inner {
    right: 24px;

    .q-card {
      border-radius: 4px !important;
      min-width: 450px;

      .q-card__section {
        border-radius: 0;
      }
    }
  }

  .alt-card {
    @at-root .body--light & {
      background-color: $grey-2;
      border-top: 1px solid $grey-4;
      box-shadow: inset 0 1px 0 0 #FFF, inset 0 -1px 0 0 #FFF;
      border-bottom: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-top: 1px solid lighten($dark-3, 8%);
      box-shadow: inset 0 1px 0 0 $dark-6, inset 0 -1px 0 0 $dark-6;
      border-bottom: 1px solid lighten($dark-3, 8%);
    }
  }

  &-quickaccess {
    width: 40px;
    border-radius: 4px !important;
    background-color: rgba(0,0,0,.75);
    color: #FFF;
    position: fixed;
    right: 486px;
    top: 74px;
    z-index: -1;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 5px 0 rgba(0,0,0,.5) !important;

    @at-root .q-transition--jump-left-enter-active & {
      display: none !important;
    }

    @at-root .q-transition--jump-right-leave-active & {
      display: none !important;
    }
  }
}

.q-card {
  @at-root .body--light & {
    background-color: #FFF;
  }
  @at-root .body--dark & {
    background-color: $dark-3;
  }
}
</style>
