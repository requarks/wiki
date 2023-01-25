<template lang="pug">
  div
    .pa-3.d-flex(v-if='navMode === `MIXED`', :class='$vuetify.theme.dark ? `grey darken-5` : `blue darken-3`')
      v-btn(
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='min-width:0;'
        @click='goHome'
        :aria-label='$t(`common:header.home`)'
        )
        v-icon(size='20') mdi-home
      v-btn.ml-3(
        v-if='currentMode === `custom`'
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='flex: 1 1 100%;'
        @click='switchMode(`browse`)'
        )
        v-icon(left) mdi-file-tree
        .body-2.text-none {{$t('common:sidebar.browse')}}
      v-btn.ml-3(
        v-else-if='currentMode === `browse`'
        depressed
        :color='$vuetify.theme.dark ? `grey darken-4` : `blue darken-2`'
        style='flex: 1 1 100%;'
        @click='switchMode(`custom`)'
        )
        v-icon(left) mdi-navigation
        .body-2.text-none {{$t('common:sidebar.mainMenu')}}
    v-divider
    //-> Custom Navigation
    v-list.py-2(v-if='currentMode === `custom`', dense, :class='color', :dark='dark')
      template(v-for='item of items')
        v-list-item(
          v-if='item.k === `link`'
          :href='item.t'
          :target='item.y === `externalblank` ? `_blank` : `_self`'
          :rel='item.y === `externalblank` ? `noopener` : ``'
          )
          v-list-item-avatar(size='24', tile)
            v-icon(v-if='item.c.match(/fa[a-z] fa-/)', size='19') {{ item.c }}
            v-icon(v-else) {{ item.c }}
          v-list-item-title {{ item.l }}
        v-divider.my-2(v-else-if='item.k === `divider`')
        v-subheader.pl-4(v-else-if='item.k === `header`') {{ item.l }}
    //-> Browse
    v-list.py-2(v-else-if='currentMode === `browse`', dense, :class='color', :dark='dark')
      template(v-if='currentParent.id > 0')
        v-list-item(v-for='(item, idx) of parents', :key='`parent-` + item.id', @click='fetchBrowseItems(item)', style='min-height: 30px;')
          v-list-item-avatar(size='18', :style='`padding-left: ` + (idx * 8) + `px; width: auto; margin: 0 5px 0 0;`')
            v-icon(small) mdi-folder-open
          v-list-item-title {{ item.title }}
        v-divider.mt-2
        v-list-item.mt-2(v-if='currentParent.pageId > 0', :href='`/` + currentParent.locale + `/` + currentParent.path', :key='`directorypage-` + currentParent.id', :input-value='path === currentParent.path')
          v-list-item-avatar(size='24')
            v-icon mdi-text-box
          v-list-item-title {{ currentParent.title }}
        v-subheader.pl-4 {{$t('common:sidebar.currentDirectory')}}
      template(v-for='item of currentItems')
        v-list-item(v-if='item.isFolder', :key='`childfolder-` + item.id', @click='fetchBrowseItems(item)')
          v-list-item-avatar(size='24')
            v-icon mdi-folder
          v-list-item-title {{ item.title }}
        v-list-item(v-else, :href='`/` + item.locale + `/` + item.path', :key='`childpage-` + item.id', :input-value='path === item.path')
          v-list-item-avatar(size='24')
            v-icon mdi-text-box
          v-list-item-title {{ item.title }}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'
import { get } from 'vuex-pathify'

/* global siteLangs */

export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    },
    items: {
      type: Array,
      default: () => []
    },
    navMode: {
      type: String,
      default: 'MIXED'
    }
  },
  data() {
    return {
      currentMode: 'custom',
      currentItems: [],
      currentParent: {
        id: 0,
        title: '/ (root)'
      },
      parents: [],
      loadedCache: []
    }
  },
  computed: {
    path: get('page/path'),
    locale: get('page/locale')
  },
  methods: {
    switchMode(mode) {
      this.currentMode = mode
      window.localStorage.setItem('navPref', mode)
      if (mode === `browse` && this.loadedCache.length < 1) {
        this.loadFromCurrentPath()
      }
    },
    async fetchBrowseItems(item) {
      this.$store.commit(`loadingStart`, 'browse-load')
      if (!item) {
        item = this.currentParent
      }

      if (this.loadedCache.indexOf(item.id) < 0) {
        this.currentItems = []
      }

      if (item.id === 0) {
        this.parents = []
      } else {
        const flushRightIndex = _.findIndex(this.parents, ['id', item.id])
        if (flushRightIndex >= 0) {
          this.parents = _.take(this.parents, flushRightIndex)
        }
        if (this.parents.length < 1) {
          this.parents.push(this.currentParent)
        }
        this.parents.push(item)
      }

      this.currentParent = item

      const resp = await this.$apollo.query({
        query: gql`
          query ($parent: Int, $locale: String!) {
            pages {
              tree(parent: $parent, mode: ALL, locale: $locale) {
                id
                path
                title
                isFolder
                pageId
                parent
                locale
              }
            }
          }
        `,
        fetchPolicy: 'cache-first',
        variables: {
          parent: item.id,
          locale: this.locale
        }
      })
      this.loadedCache = _.union(this.loadedCache, [item.id])
      this.currentItems = _.get(resp, 'data.pages.tree', [])
      this.$store.commit(`loadingStop`, 'browse-load')
    },
    async loadFromCurrentPath() {
      this.$store.commit(`loadingStart`, 'browse-load')
      const resp = await this.$apollo.query({
        query: gql`
          query ($path: String, $locale: String!) {
            pages {
              tree(path: $path, mode: ALL, locale: $locale, includeAncestors: true) {
                id
                path
                title
                isFolder
                pageId
                parent
                locale
              }
            }
          }
        `,
        fetchPolicy: 'cache-first',
        variables: {
          path: this.path,
          locale: this.locale
        }
      })
      const items = _.get(resp, 'data.pages.tree', [])
      const curPage = _.find(items, ['pageId', this.$store.get('page/id')])
      if (!curPage) {
        console.warn('Could not find current page in page tree listing!')
        return
      }

      let curParentId = curPage.parent
      let invertedAncestors = []
      while (curParentId) {
        const curParent = _.find(items, ['id', curParentId])
        if (!curParent) {
          break
        }
        invertedAncestors.push(curParent)
        curParentId = curParent.parent
      }

      this.parents = [this.currentParent, ...invertedAncestors.reverse()]
      this.currentParent = _.last(this.parents)

      this.loadedCache = [curPage.parent]
      this.currentItems = _.filter(items, ['parent', curPage.parent])
      this.$store.commit(`loadingStop`, 'browse-load')
    },
    goHome() {
      window.location.assign(siteLangs.length > 0 ? `/${this.locale}/home` : '/')
    }
  },
  mounted() {
    this.currentParent.title = `/ ${this.$t('common:sidebar.root')}`
    if (this.navMode === 'TREE') {
      this.currentMode = 'browse'
    } else if (this.navMode === 'STATIC') {
      this.currentMode = 'custom'
    } else {
      this.currentMode = window.localStorage.getItem('navPref') || 'custom'
    }
    if (this.currentMode === 'browse') {
      this.loadFromCurrentPath()
    }
  }
}

const res = `Frequently Asked Questions About Terminating Full-Time Employees

Off-boarding employees, whether by resignation or termination, is a complex legal process. Different jurisdictions have different requirements with respect to employee off-boarding. Deel will always comply with local requirements when completing an off-boarding request. 

This article is for Clients of Deel who have remote employees hired through a Deel Employer of Record. 

For information on terminating a full-time employee see How to Terminate a Full-Time Employee.

For information about local off-boarding requirements including disciplinary processes, notice requirements, and severance please login to Deel to see our Terminations Landscape Guide.

In this Article

Off-boarding Requests 

Communicating with Employees

Benefits, Severance, and Final Pay



Off-Boarding Requests

Off-boarding a full-time remote employee hired through an Employer of Record isn’t like off-boarding your local employees. Different jurisdictions have different rules that govern the employment relationship.

You can learn more about local termination rules by logging in to Deel to see our Terminations Landscape Guide.



What kind of off-boarding requests can I initiate?

You may request a termination with cause, without cause, a resignation, or a mutual termination.  As the employer of record, Deel’s legal team will carefully review all the facts and circumstances. In certain situations Deel may advise you of the need to adjust the request in order to comply with local legal requirements to ensure a lawful termination.



What information do I need to provide?

You must provide all details relevant to the off-boarding request. See our Termination Landscape Guide for a description of the grounds or reasons for different termination types.

You will need to provide the appropriate documentation to support the request. This may include evidence of alleged wrongdoing, performance management plans and reviews, attendance information, and all other documentation necessary to support your request.

Deel will contact you if additional information is required.

Why do I need to provide 30 days notice to process a termination request?

Different jurisdictions have different termination requirements. In most jurisdictions, employees enjoy protection from arbitrary termination and have the right to challenge terminations they believe are unfair or unlawful.

Under the terms of the Master Service Agreement, Deel requires 30 days notice in order to evaluate the facts and circumstances of the termination and advise on the most viable and legally compliant termination strategy. In some cases, such as termination during the probation period, Deel may process the termination request in less than 30 days. 

Any contractual or statutory notice period will be in addition to the 30 days process requirement.



What if I want to terminate an employee immediately?

In cases of properly documented gross misconduct it may be possible to terminate an employee without notice. In most jurisdictions such terminations can only be undertaken in the most grievous of circumstances, including violence or fraud. In these urgent cases please contact your account manager or Deel Support immediately to initiate the termination process. 

Please be advised that it is not usually possible to terminate an employee without notice for poor performance. In most jurisdictions, employees have the right to challenge a termination without notice as unfair or unlawful in court. 



What is the timeline for processing a resignation?

While resignation requests can be processed more quickly than other termination requests, Deel must still evaluate the local legal requirements to ensure compliance. In some jurisdictions employees must provide contractual or statutory notice and in some cases, may be entitled to payments of pro-rated or other accrued benefits or entitlements. You can learn more about local requirements in our Global Terminations Landscape Guide.

When is the last day of employment?

The last day of employment will depend on local notice requirements, and the facts and circumstances of your request. As part of the off-boarding process, Deel will determine the most viable and legally compliant termination method.  The last day of employment will be contingent on all aspects of the off-boarding process, including any statutory requirements, signatures, payroll cut-off dates, and other requirements.



How can I track the status of my request?

You can track the status of your termination request from the Activity Tracker located on the Deel Homepage.



Communicating with Employees

As the employer of record, Deel must take the lead on all communication with employees about termination except in cases of employee resignation. This will reduce the risk of non-compliance with local employment and privacy laws.



Who notifies the employee?

Deel will work with you to notify the employee. In many jurisdictions Deel must initiate the termination process. In other cases, it may be possible for you to notify the employee after the most viable termination strategy has been agreed on. In all cases, it is essential that you not communicate with the employee about their termination until the most legally compliant and viable termination strategy has been identified.

When will the employee be notified?

Employees will be notified  by Deel after you have confirmed your acceptance of the proposed termination agreement.



Why can't I communicate termination details to the employee?

As the employer of record, Deel is responsible for terminating the employee. Different jurisdictions have different rules with respect to employee privacy and protections. Premature communication with the employee - including casual conversations about reasons or motives - could reduce the termination options available, or risk having the termination challenged as unfair or unlawful in court. 

Deel will work with you to determine the most viable strategy and advise on any communication requirements or limits.



Can I review the separation agreement?

If requested, you will have an opportunity to review the separation agreement prior to its execution with the employee.



Benefits, Severance, and Final Pay

Employee entitled to certain accrued or pro-rated benefits, severance and pay differs from jurisdiction to jurisdiction. Deel will always ensure that employees receive all entitlements required by law. 

In addition, mutually negotiated termination agreements will always include the payment of a severance in order to reduce the risk of a termination being challenged.



When will employees receive their final pay, severance, or other entitlements?

Employees will receive their final pay, severance and other entitlements as part of our standard payroll cycle and in accordance with all local laws. In many jurisdictions this may be either the last day of the month in which the legal notice period or employment ends or the next scheduled payday. 

In cases of mutually negotiating termination agreements, the terms of payment will form part of the agreement.



Can an employee receive their pay on their last day?

Except in rare or compelling circumstances where required by law it is not possible for employees to be paid on their last day of work.



Do employees keep their benefits during the notice period?

Employees will keep their benefits in accordance with local requirements and the terms of the benefits policy. Most jurisdictions require that benefits and other entitlements continue during the notice period.`
</script>
