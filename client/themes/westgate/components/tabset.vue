<template lang="pug">
  .tabset.elevation-2
    ul.tabset-tabs(ref='tabs', role='tablist')
      slot(name='tabs')
    .tabset-content(ref='content')
      slot(name='content')
</template>

<script>
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('1234567890abcdef', 10)

export default {
  data() {
    return {
      currentTab: 0
    }
  },
  watch: {
    currentTab (newValue, oldValue) {
      this.setActiveTab()
    }
  },
  methods: {
    setActiveTab () {
      this.$refs.tabs.childNodes.forEach((node, idx) => {
        if (idx === this.currentTab) {
          node.className = 'is-active'
          node.setAttribute('aria-selected', 'true')
        } else {
          node.className = ''
          node.setAttribute('aria-selected', 'false')
        }
      })
      this.$refs.content.childNodes.forEach((node, idx) => {
        if (idx === this.currentTab) {
          node.className = 'tabset-panel is-active'
          node.removeAttribute('hidden')
        } else {
          node.className = 'tabset-panel'
          node.setAttribute('hidden', '')
        }
      })
    }
  },
  mounted () {
    // Handle scroll to header on load within hidden tab content
    if (window.location.hash && window.location.hash.length > 1) {
      const headerId = decodeURIComponent(window.location.hash)
      let foundIdx = -1
      this.$refs.content.childNodes.forEach((node, idx) => {
        if (node.querySelector(headerId)) {
          foundIdx = idx
        }
      })
      if (foundIdx >= 0) {
        this.currentTab = foundIdx
      }
    }

    this.setActiveTab()

    const tabRefId = nanoid()

    this.$refs.tabs.childNodes.forEach((node, idx) => {
      node.setAttribute('id', `${tabRefId}-${idx}`)
      node.setAttribute('role', 'tab')
      node.setAttribute('aria-controls', `${tabRefId}-${idx}-tab`)
      node.setAttribute('tabindex', '0')
      node.addEventListener('click', ev => {
        this.currentTab = [].indexOf.call(ev.target.parentNode.children, ev.target)
      })
      node.addEventListener('keydown', ev => {
        if (ev.key === 'ArrowLeft' && idx > 0) {
          this.currentTab = idx - 1
          this.$refs.tabs.childNodes[idx - 1].focus()
        } else if (ev.key === 'ArrowRight' && idx < this.$refs.tabs.childNodes.length - 1) {
          this.currentTab = idx + 1
          this.$refs.tabs.childNodes[idx + 1].focus()
        } else if (ev.key === 'Enter' || ev.key === ' ') {
          this.currentTab = idx
          node.focus()
        } else if (ev.key === 'Home') {
          this.currentTab = 0
          ev.preventDefault()
          ev.target.parentNode.children[0].focus()
        } else if (ev.key === 'End') {
          this.currentTab = this.$refs.tabs.childNodes.length - 1
          ev.preventDefault()
          ev.target.parentNode.children[this.$refs.tabs.childNodes.length - 1].focus()
        }
      })
    })

    this.$refs.content.childNodes.forEach((node, idx) => {
      node.setAttribute('id', `${tabRefId}-${idx}-tab`)
      node.setAttribute('role', 'tabpanel')
      node.setAttribute('aria-labelledby', `${tabRefId}-${idx}`)
      node.setAttribute('tabindex', '0')
    })
  }
}
</script>

<style lang="scss">
$wg-bg: #0f0d12;
$wg-panel: #141219;
$wg-panel-2: #110f15;
$wg-panel-3: #1a161d;
$wg-border: #2a252d;
$wg-gold: #c2a35a;
$wg-link-hover: #e0c878;
$wg-text: #e6e0d6;
$wg-text-soft: #b9b2a6;
$wg-text-muted: #9a9086;

.tabset {
  background: linear-gradient(100deg, rgba(42, 18, 34, 0.38), rgba(18, 16, 23, 0.96) 58%, rgba(14, 13, 18, 0.98));
  border: 1px solid rgba(194, 163, 90, 0.14);
  border-radius: 8px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    inset 0 0 34px rgba(96, 32, 68, 0.1),
    0 10px 26px rgba(0, 0, 0, 0.22);
  margin-top: 16px;
  overflow: hidden;

  > .tabset-tabs {
    padding-left: 0;
    margin: 0;
    display: flex;
    align-items: stretch;
    background: linear-gradient(to bottom, rgba(20, 18, 25, 0.96), rgba(16, 14, 20, 0.98));
    border-bottom: 1px solid rgba(194, 163, 90, 0.16);
    overflow: auto;

    > li {
      display: block;
      padding: 14px 16px;
      margin-top: 0;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      border-right: 1px solid rgba(194, 163, 90, 0.1);
      color: $wg-text-muted;
      font-size: 14px;
      font-weight: 500;
      user-select: none;

      &.is-active {
        background: linear-gradient(to bottom, rgba(194, 163, 90, 0.13), rgba(35, 27, 23, 0.48));
        box-shadow: inset 0 3px 0 $wg-gold;
        color: $wg-link-hover;
      }

      &:last-child {
        border-right: none;
      }

      &:hover {
        background: rgba(194, 163, 90, 0.08);
        color: $wg-text;

        &.is-active {
          background: linear-gradient(to bottom, rgba(194, 163, 90, 0.16), rgba(35, 27, 23, 0.54));
        }
      }

      & + li {
        border-left: 1px solid rgba(0, 0, 0, 0.32);
      }
    }
  }

  > .tabset-content {
    .tabset-panel {
      color: $wg-text-soft;
      display: none;
      padding: 18px 18px 20px;

      &.is-active {
        display: block;
      }
    }
  }
}
</style>
