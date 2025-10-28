/*
 * This object is a mirror of the material colors found in client/scss/base/material.scss
 */

// Helper to create color scales
function createScale(arr, extra = {}) {
  const scale = {}
  arr.forEach((hex, i) => {
    scale[`${(i + 1) * 50}`] = hex
  })
  return { ...scale, ...extra }
}

const colors = {
  'neutral': createScale([
    '#fafafa', '#e7e7e8', '#d4d4d6', '#c7c8cb', '#bdbdc1', '#b1b2b6', '#a6a6ab', '#9a9ba1', '#8f9097', '#83848b',
    '#777880', '#6b6d76', '#61626c', '#565862', '#4a4c57', '#3e3f4b', '#333541', '#272936', '#1d1f29', '#111218'
  ], { '1000': '#111218' }),

  'blue': createScale([
    '#f6fafe', '#e9f4fc', '#b4dbf1', '#94ceed', '#12abdb', '#098dc4', '#0070ad', '#005786', '#00476d', '#00324d'
  ], { 'b6%': 'rgba(0,112,173,0.06)' }),

  'green': createScale([
    '#eff7f5', '#e7f6eb', '#cdedd5', '#afe3bd', '#8ad9a2', '#57cf80', '#4eb972', '#43a063', '#1e5631', '#0f2e22'
  ]),

  'peacock': createScale([
    '#f2fcfa', '#e4f9f5', '#c6f3ec', '#a1ede1', '#72e7d6', '#00e0cb', '#00c8b6', '#00ae9d', '#008e80', '#00645b'
  ]),

  'teal': createScale([
    '#f2fdfc', '#e4fafa', '#c6f5f4', '#a1f0ef', '#72ebe9', '#00e6e3', '#00cecb', '#00b2b0', '#009190', '#006766'
  ]),

  'sapphire': createScale([
    '#edf5f7', '#c9e1e8', '#84b9c7', '#64a5b4', '#4790a1', '#338091', '#2e7282', '#286370', '#20515c', '#173941'
  ]),

  'yellow': createScale([
    '#fffcf5', '#fff8eb', '#fff1d5', '#ffeabd', '#ffe2a2', '#ffda80', '#e4c372', '#c6a963', '#a18a51', '#726139'
  ]),

  'red': createScale([
    '#fbf2f3', '#ffcaca', '#ffa7a9', '#ff848b', '#ff6270', '#f64059', '#dd1d46', '#c00036', '#9e0029', '#5d051a'
  ]),

  'surfaceLight': {
    'pageBackground': '#ffffff',
    'primaryNeutralLite': '#ffffff',
    'secondaryNeutralLite': '#fafafa',
    'tertiaryNeutralLite': '#e7e7e8',
    'primaryBlueLite': '#f6fafe',
    'secondaryBlueLite': '#e9f4fc',
    'tertiaryBlueLite': '#12abdb',
    'primarySapLite': '#edf5f7',
    'primaryNeutralHeavy': '#1d1f29',
    'secondaryNeutralHeavy': '#4a4c57',
    'primarySapHeavy': '#286370',
    'secondarySapHeavy': '#338091',
    'primaryBlueHeavy': '#00476d',
    'secondaryBlueHeavy': '#0070ad',
    'disabled': '#fafafa',
    'inverse': '#3e3f4b',
    'white': '#ffffff',
    'black': '#000000',
    'infoLite': '#6b6d76',
    'infoHeavy': '#fafafa',
    'noticeLite': '#f68f40',
    'noticeHeavy': '#fcb988',
    'positive': '#eff7f5',
    'negative': '#fbf2f3'
  },

  'surfaceDark': {
    'pageBackground': '#111218',
    'primaryNeutralLite': '#1d1f29',
    'secondaryNeutralLite': '#272936',
    'tertiaryNeutralLite': '#3e3f4b',
    'primaryBlueLite': '#272936',
    'secondaryBlueLite': '#00476d',
    'tertiaryBlueLite': '#0070ad',
    'primarySapLite': '#173941',
    'primaryNeutralHeavy': '#272936',
    'secondaryNeutralHeavy': '#333541',
    'primarySapHeavy': '#173941',
    'secondarySapHeavy': '#20515c',
    'primaryBlueHeavy': '#00324d',
    'secondaryBlueHeavy': '#005786',
    'disabled': '#4a4c57',
    'inverse': '#ffffff',
    'white': '#ffffff',
    'black': '#000000',
    'infoLite': '#12abdb',
    'infoHeavy': '#00476d',
    'noticeLite': '#f9a464',
    'noticeHeavy': '#fcb988',
    'positive': '#173941',
    'negative': '#5d051a'
  },

  'actionLight': {
    'active': '#0070ad',
    'highlightOnLite': '#72e7d6',
    'contentOnLite': '#1d1f29',
    'contentWhite': '#ffffff',
    'contentInverse': '#ffffff',
    'focusOnLite': '#333541',
    'focusOnHeavy': '#ffffff',
    'primaryDefaultOnLite': '#00324d',
    'primaryHoverOnLite': '#00476d',
    'primaryPressedOnLite': '#005786',
    'primaryDisabledOnLite': '#c7c8cb',
    'primaryDefaultOnHeavy': '#ffffff',
    'primaryHoverOnHeavy': '#e7e7e8',
    'primaryPressedOnHeavy': '#fafafa',
    'primaryDisabledOnHeavy': '#c7c8cb',
    'primaryDefaultOnPhoto': 'rgba(0,0,0,0.15)',
    'secondaryDefaultOnLite': '#00324d',
    'secondaryHoverOnLite': '#00324d',
    'secondaryPressedOnLite': '#00476d',
    'secondaryDisabledOnLite': '#a6a6ab',
    'secondaryDefaultOnHeavy': '#ffffff',
    'secondaryHoverOnHeavy': '#ffffff',
    'secondaryPressedOnHeavy': '#e7e7e8',
    'secondaryDisabledOnHeavy': '#777880'
  },

  'actionDark': {
    'active': '#b4dbf1',
    'highlightOnLite': '#00ae9d',
    'contentOnLite': '#1d1f29',
    'contentWhite': '#ffffff',
    'contentInverse': '#1d1f29',
    'focusOnLite': '#ffffff',
    'focusOnHeavy': '#ffffff',
    'primaryDefaultOnLite': '#ffffff',
    'primaryHoverOnLite': '#e7e7e8',
    'primaryPressedOnLite': '#fafafa',
    'primaryDisabledOnLite': '#c7c8cb',
    'primaryDefaultOnHeavy': '#ffffff',
    'primaryHoverOnHeavy': '#e7e7e8',
    'primaryPressedOnHeavy': '#fafafa',
    'primaryDisabledOnHeavy': '#c7c8cb',
    'primaryDefaultOnPhoto': 'rgba(0,0,0,0.15)',
    'secondaryDefaultOnLite': '#ffffff',
    'secondaryHoverOnLite': '#ffffff',
    'secondaryPressedOnLite': '#e7e7e8',
    'secondaryDisabledOnLite': '#a6a6ab',
    'secondaryDefaultOnHeavy': '#ffffff',
    'secondaryHoverOnHeavy': '#ffffff',
    'secondaryPressedOnHeavy': '#e7e7e8',
    'secondaryDisabledOnHeavy': '#777880'
  },

  'warningActionLight': {
    'content': '#1d1f29',
    'primaryDefault': '#f64059',
    'hover': '#ff6270',
    'hoverOutline': '#f64059',
    'pressed': '#f64059',
    'pressedOutline': '#dd1d46',
    'secondaryDefault': '#9e0029',
    'secondaryHover': '#c00036'
  },

  'warningActionDark': {
    'content': '#9e0029',
    'primaryDefault': '#ffffff',
    'hover': '#e7e7e8',
    'hoverOutline': '#e7e7e8',
    'pressed': '#fafafa',
    'pressedOutline': '#fafafa',
    'secondaryDefault': '#ff848b',
    'secondaryHover': '#ffa7a9'
  },

  'borderLight': {
    'primary': '#c7c8cb',
    'secondary': '#e7e7e8',
    'disabled': '#e7e7e8',
    'inverse': '#ffffff',
    'focus': '#333541',
    'info': '#0070ad',
    'negative': '#dd1d46',
    'notice': '#e4c372',
    'positive': '#4eb972'
  },

  'borderDark': {
    'primary': '#83848b',
    'secondary': '#3e3f4b',
    'disabled': '#565862',
    'inverse': '#272936',
    'focus': '#ffffff',
    'info': '#12abdb',
    'negative': '#ff6270',
    'notice': '#ffe2a2',
    'positive': '#8ad9a2'
  },

  'textLight': {
    'primary': '#171a22',
    'secondary': '#595e6a',
    'tertiary': '#6b6d76',
    'brandPrimary': '#00476d',
    'brandSecondary': '#005786',
    'brandTertiary': '#0070ad',
    'inverse': '#ffffff',
    'disabled': '#9a9ba1',
    'white': '#ffffff',
    'black': '#171a22',
    'link': '#00324d',
    'linkHover': '#00476d',
    'linkPressed': '#005786',
    'infoOnLite': '#6b6d76',
    'infoOnHeavy': '#3e3f4b',
    'noticeOnLite': '#f68f40',
    'noticeOnHeavy': '#cc640f',
    'positiveOnLite': '#4eb972',
    'positiveOnHeavy': '#1e5631',
    'negativeOnLite': '#9e0029',
    'negativeOnHeavy': '#9e0029'
  },

  'textDark': {
    'primary': '#f8fafc',
    'secondary': '#f1f4f7',
    'tertiary': '#9a9ba1',
    'brandPrimary': '#94ceed',
    'brandSecondary': '#098dc4',
    'brandTertiary': '#005786',
    'inverse': '#272936',
    'disabled': '#4a4c57',
    'white': '#ffffff',
    'black': '#272936',
    'link': '#ffffff',
    'linkHover': '#e7e7e8',
    'linkPressed': '#fafafa',
    'infoOnLite': '#c7c8cb',
    'infoOnHeavy': '#9a9ba1',
    'noticeOnLite': '#f68f40',
    'noticeOnHeavy': '#fcb988',
    'positiveOnLite': '#57cf80',
    'positiveOnHeavy': '#afe3bd',
    'negativeOnLite': '#ffa7a9',
    'negativeOnHeavy': '#ff848b'
  },

  'overlay': {
    'page': 'rgba(29,31,41,0.4)',
    'heroPhoto': 'rgba(0,0,0,0.55)'
  },

  'alert': {
    'error': '#dd1d46',
    'errorOnDark': '#9e0029',
    'errorLight': '#ffa7a9',
    'info': '#12abdb',
    'infoOnDark': '#00476d',
    'infoLight': '#b4dbf1',
    'success': '#4eb972',
    'successOnDark': '#43a063',
    'successLight': '#cdedd5',
    'warning': '#e4c372',
    'warningOnDark': '#e4c372',
    'warningLight': '#fff1d5'
  }
}

export default colors
