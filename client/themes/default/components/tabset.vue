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
.tabset {
  border-radius: 5px;
  margin-top: 10px;

  @at-root .theme--dark & {
    background-color: #292929;
  }

  > .tabset-tabs {
    padding-left: 0;
    margin: 0;
    display: flex;
    align-items: stretch;
    background: linear-gradient(to bottom, #FFF, #FAFAFA);
    box-shadow: inset 0 -1px 0 0 #DDD;
    border-radius: 5px 5px 0 0;
    overflow: auto;

    @at-root .theme--dark & {
      background: linear-gradient(to bottom, #424242, #333);
      box-shadow: inset 0 -1px 0 0 #555;
    }

    > li {
      display: block;
      padding: 16px;
      margin-top: 0;
      cursor: pointer;
      transition: color 1s ease;
      border-right: 1px solid #FFF;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 1px;
      user-select: none;

      @at-root .theme--dark & {
        border-right-color: #555;
      }

      &.is-active {
        background-color: #FFF;
        margin-bottom: 0;
        padding-bottom: 17px;
        padding-top: 13px;
        color: mc('blue', '700');
        border-top: 3px solid mc('blue', '700');

        @at-root .theme--dark & {
          background-color: #292929;
          color: mc('blue', '300');
        }
      }

      &:last-child {
        border-right: none;

        &.is-active {
          border-right: 1px solid #EEE;

          @at-root .theme--dark & {
            border-right-color: #555;
          }
        }
      }

      &:hover {
        background-color: rgba(#CCC, .1);

        @at-root .theme--dark & {
          background-color: rgba(#222, .25);
        }

        &.is-active {
          background-color: #FFF;

          @at-root .theme--dark & {
            background-color: #292929;
          }
        }
      }

      & + li {
        border-left: 1px solid #EEE;

        @at-root .theme--dark & {
          border-left-color: #222;
        }
      }
    }
  }

  > .tabset-content {
    .tabset-panel {
      padding: 2px 16px 16px;
      display: none;

      &.is-active {
        display: block;
      }
    }
  }
}
</style>
