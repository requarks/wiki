const protanopia = {
  negative: '#fb8c00',
  positive: '#2196f3',
  primary: '#1976D2',
  secondary: '#2196f3'
}

const deuteranopia = {
  negative: '#ef6c00',
  positive: '#2196f3',
  primary: '#1976D2',
  secondary: '#2196f3'
}

const tritanopia = {
  primary: '#e91e63',
  secondary: '#02C39A'
}

export function getAccessibleColor (name, base, cvd) {
  switch (cvd) {
    case 'protanopia': {
      return protanopia[name] ?? base
    }
    case 'deuteranopia': {
      return deuteranopia[name] ?? base
    }
    case 'tritanopia': {
      return tritanopia[name] ?? base
    }
  }
  return base
}
