<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-venn-diagram.svg', alt='Visualize Pages', style='width: 80px;')
          .admin-header-title
            .headline.blue--text.text--darken-2.animated.fadeInLeft Visualize Pages
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p2s Dendrogram representation of your pages
          v-spacer
          v-select.mx-5.animated.fadeInDown.wait-p1s(
            v-if='locales.length > 0'
            v-model='currentLocale'
            :items='locales'
            style='flex: 0 1 120px;'
            solo
            dense
            hide-details
            item-value='code'
            item-text='name'
          )
          v-btn-toggle.animated.fadeInDown(v-model='graphMode', color='primary', dense, rounded)
            v-btn.px-5(value='htree')
              v-icon(left, :color='graphMode === `htree` ? `primary` : `grey darken-3`') mdi-sitemap
              span.text-none Hierarchical Tree
            v-btn.px-5(value='hradial')
              v-icon(left, :color='graphMode === `hradial` ? `primary` : `grey darken-3`') mdi-chart-donut-variant
              span.text-none Hierarchical Radial
            v-btn.px-5(value='rradial')
              v-icon(left, :color='graphMode === `rradial` ? `primary` : `grey darken-3`') mdi-blur-radial
              span.text-none Relational Radial
        .admin-pages-visualize-svg(ref='svgContainer', v-show='pages.length >= 1')
        v-alert(v-if='pages.length < 1', outlined, type='warning', style='max-width: 650px; margin: 0 auto;') Looks like there's no data yet to graph!
</template>

<script>
import _ from 'lodash'
import * as d3 from 'd3'
import gql from 'graphql-tag'

/* global siteConfig, siteLangs */

export default {
  data() {
    return {
      graphMode: 'htree',
      width: 800,
      radius: 400,
      pages: [],
      locales: siteLangs,
      currentLocale: siteConfig.lang
    }
  },
  watch: {
    pages () {
      this.redraw()
    },
    graphMode () {
      this.redraw()
    }
  },
  methods: {
    goToPage (d) {
      const id = d.data.id
      if (id) {
        if (d3.event.ctrlKey || d3.event.metaKey) {
          const { href } = this.$router.resolve(String(id))
          window.open(href, '_blank')
        } else {
          this.$router.push(String(id))
        }
      }
    },
    bilink (root) {
      const map = new Map(root.descendants().map(d => [d.data.path, d]))
      for (const d of root.descendants()) {
        d.incoming = []
        d.outgoing = []
        d.data.links.forEach(i => {
          const relNode = map.get(i)
          if (relNode) {
            d.outgoing.push([d, relNode])
          }
        })
      }
      for (const d of root.descendants()) {
        for (const o of d.outgoing) {
          if (o[1]) {
            o[1].incoming.push(o)
          }
        }
      }
      return root
    },
    hierarchy (pages) {
      const map = new Map(pages.map(p => [p.path, p]))
      const getPage = path => map.get(path) || {
        path: path,
        title: path.split('/').slice(-1)[0],
        links: []
      }

      function recurse (depth, [parent, descendants]) {
        const truncatePath = path => _.take(path.split('/'), depth).join('/')
        const descendantsByChild =
          Object.entries(_.groupBy(descendants, page => truncatePath(page.path)))
            .map(([childPath, descendantsGroup]) => [getPage(childPath), descendantsGroup])
            .map(([child, descendantsGroup]) =>
              [child, _.filter(descendantsGroup, d => d.path !== child.path)])
        return {
          ...parent,
          children: descendantsByChild.map(_.partial(recurse, depth + 1))
        }
      }
      const root = { path: this.currentLocale, title: this.currentLocale, links: [] }
      // start at depth=2 because we're taking {locale} as the root and
      // all paths start with {locale}/
      return recurse(2, [root, pages])
    },
    /**
     * Relational Radial
     */
    drawRelations () {
      const data = this.hierarchy(this.pages)

      const line = d3.lineRadial()
        .curve(d3.curveBundle.beta(0.85))
        .radius(d => d.y)
        .angle(d => d.x)

      const tree = d3.cluster()
        .size([2 * Math.PI, this.radius - 100])

      const root = tree(this.bilink(d3.hierarchy(data)
        .sort((a, b) => d3.ascending(a.height, b.height) || d3.ascending(a.data.path, b.data.path))))

      const svg = d3.create('svg')
        .attr('viewBox', [-this.width / 2, -this.width / 2, this.width, this.width])

      const g = svg.append('g')

      svg.call(d3.zoom().on('zoom', function() {
        g.attr('transform', d3.event.transform)
      }))

      const link = g.append('g')
        .attr('stroke', '#CCC')
        .attr('fill', 'none')
        .selectAll('path')
        .data(root.descendants().flatMap(leaf => leaf.outgoing))
        .join('path')
        .style('mix-blend-mode', 'multiply')
        .attr('d', ([i, o]) => line(i.path(o)))
        .each(function(d) { d.path = this })

      g.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .selectAll('g')
        .data(root.descendants())
        .join('g')
        .attr('transform', d => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`)
        .append('text')
        .attr('dy', '0.31em')
        .attr('x', d => d.x < Math.PI ? 6 : -6)
        .attr('text-anchor', d => d.x < Math.PI ? 'start' : 'end')
        .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
        .attr('fill', this.$vuetify.theme.dark ? 'white' : '')
        .attr('cursor', 'pointer')
        .text(d => d.data.title)
        .each(function(d) { d.text = this })
        .on('mouseover', overed)
        .on('mouseout', outed)
        .on('click', d => this.goToPage(d))
        .call(text => text.append('title').text(d => `${d.data.path}
          ${d.outgoing.length} outgoing
          ${d.incoming.length} incoming`))
        .clone(true).lower()
        .attr('stroke', this.$vuetify.theme.dark ? '#222' : 'white')

      function overed(d) {
        link.style('mix-blend-mode', null)
        d3.select(this).attr('font-weight', 'bold')
        d3.selectAll(d.incoming.map(d => d.path)).attr('stroke', '#2196F3').raise()
        d3.selectAll(d.incoming.map(([d]) => d.text)).attr('fill', '#2196F3').attr('font-weight', 'bold')
        d3.selectAll(d.outgoing.map(d => d.path)).attr('stroke', '#E91E63').raise()
        d3.selectAll(d.outgoing.map(([, d]) => d.text)).attr('fill', '#E91E63').attr('font-weight', 'bold')
      }

      function outed(d) {
        link.style('mix-blend-mode', 'multiply')
        d3.select(this).attr('font-weight', null)
        d3.selectAll(d.incoming.map(d => d.path)).attr('stroke', null)
        d3.selectAll(d.incoming.map(([d]) => d.text)).attr('fill', null).attr('font-weight', null)
        d3.selectAll(d.outgoing.map(d => d.path)).attr('stroke', null)
        d3.selectAll(d.outgoing.map(([, d]) => d.text)).attr('fill', null).attr('font-weight', null)
      }

      this.$refs.svgContainer.appendChild(svg.node())
    },
    /**
     * Hierarchical Tree
     */
    drawTree () {
      const data = this.hierarchy(this.pages)

      const treeRoot = d3.hierarchy(data)
      treeRoot.dx = 10
      treeRoot.dy = this.width / (treeRoot.height + 1)
      const root = d3.tree().nodeSize([treeRoot.dx, treeRoot.dy])(treeRoot)

      let x0 = Infinity
      let x1 = -x0
      root.each(d => {
        if (d.x > x1) x1 = d.x
        if (d.x < x0) x0 = d.x
      })

      const svg = d3.create('svg')
        .attr('viewBox', [0, 0, this.width, x1 - x0 + root.dx * 2])

      // this extra level is necessary because the element that we
      // apply the zoom tranform to must be above the element where
      // we apply the translation (`g`), or else zoom is wonky
      const gZoom = svg.append('g')

      svg.call(d3.zoom().on('zoom', function() {
        gZoom.attr('transform', d3.event.transform)
      }))

      const g = gZoom.append('g')
        .attr('font-family', 'sans-serif')
        .attr('font-size', 10)
        .attr('transform', `translate(${root.dy / 3},${root.dx - x0})`)

      g.append('g')
        .attr('fill', 'none')
        .attr('stroke', this.$vuetify.theme.dark ? '#999' : '#555')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1.5)
        .selectAll('path')
        .data(root.links())
        .join('path')
        .attr('d', d3.linkHorizontal()
          .x(d => d.y)
          .y(d => d.x))

      const node = g.append('g')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-width', 3)
        .selectAll('g')
        .data(root.descendants())
        .join('g')
        .attr('transform', d => `translate(${d.y},${d.x})`)

      node.append('circle')
        .attr('fill', d => d.children ? '#555' : '#999')
        .attr('r', 2.5)

      node.append('text')
        .attr('dy', '0.31em')
        .attr('x', d => d.children ? -6 : 6)
        .attr('text-anchor', d => d.children ? 'end' : 'start')
        .attr('fill', this.$vuetify.theme.dark ? 'white' : '')
        .attr('cursor', 'pointer')
        .text(d => d.data.title)
        .on('click', d => this.goToPage(d))
        .clone(true).lower()
        .attr('stroke', this.$vuetify.theme.dark ? '#222' : 'white')

      this.$refs.svgContainer.appendChild(svg.node())
    },
    /**
     * Hierarchical Radial
     */
    drawRadialTree () {
      const data = this.hierarchy(this.pages)

      const tree = d3.tree()
        .size([2 * Math.PI, this.radius])
        .separation((a, b) => (a.parent === b.parent ? 1 : 2) / a.depth)

      const root = tree(d3.hierarchy(data)
        .sort((a, b) => d3.ascending(a.data.title, b.data.title)))

      const svg = d3.create('svg')
        .style('font', '10px sans-serif')

      const g = svg.append('g')

      svg.call(d3.zoom().on('zoom', function () {
        g.attr('transform', d3.event.transform)
      }))

      // eslint-disable-next-line no-unused-vars
      const link = g.append('g')
        .attr('fill', 'none')
        .attr('stroke', this.$vuetify.theme.dark ? 'white' : '#555')
        .attr('stroke-opacity', 0.4)
        .attr('stroke-width', 1.5)
        .selectAll('path')
        .data(root.links())
        .join('path')
        .attr('d', d3.linkRadial()
          .angle(d => d.x)
          .radius(d => d.y))

      const node = g.append('g')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-width', 3)
        .selectAll('g')
        .data(root.descendants().reverse())
        .join('g')
        .attr('transform', d => `
          rotate(${d.x * 180 / Math.PI - 90})
          translate(${d.y},0)
        `)

      node.append('circle')
        .attr('fill', d => d.children ? '#555' : '#999')
        .attr('r', 2.5)

      node.append('text')
        .attr('dy', '0.31em')
        /* eslint-disable no-mixed-operators */
        .attr('x', d => d.x < Math.PI === !d.children ? 6 : -6)
        .attr('text-anchor', d => d.x < Math.PI === !d.children ? 'start' : 'end')
        .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
        /* eslint-enable no-mixed-operators */
        .attr('fill', this.$vuetify.theme.dark ? 'white' : '')
        .attr('cursor', 'pointer')
        .text(d => d.data.title)
        .on('click', d => this.goToPage(d))
        .clone(true).lower()
        .attr('stroke', this.$vuetify.theme.dark ? '#222' : 'white')

      this.$refs.svgContainer.appendChild(svg.node())

      function autoBox() {
        const {x, y, width, height} = this.getBBox()
        return [x, y, width, height]
      }

      svg.attr('viewBox', autoBox)
    },
    redraw () {
      while (this.$refs.svgContainer.firstChild) {
        this.$refs.svgContainer.firstChild.remove()
      }
      if (this.pages.length > 0) {
        switch (this.graphMode) {
          case 'rradial':
            this.drawRelations()
            break
          case 'htree':
            this.drawTree()
            break
          case 'hradial':
            this.drawRadialTree()
            break
        }
      }
    }
  },
  apollo: {
    pages: {
      query: gql`
        query ($locale: String!) {
          pages {
            links(locale: $locale) {
              id
              path
              title
              links
            }
          }
        }
      `,
      variables () {
        return {
          locale: this.currentLocale
        }
      },
      fetchPolicy: 'network-only',
      update: (data) => data.pages.links,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-pages-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>
.admin-pages-visualize-svg {
  text-align: center;
  // 100vh - header - title section - footer - content padding
  height: calc(100vh - 64px - 92px - 32px - 16px);

  > svg {
    height: 100%;
    width: 100%;
  }
}
</style>
