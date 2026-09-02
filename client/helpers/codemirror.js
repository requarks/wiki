const DEFAULT_CODEMIRROR_INPUT_STYLE = 'contenteditable'

export function isIOSDevice({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  return /iP(?:ad|hone|od)/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}

export function getCodeMirrorInputStyle(nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  if (!nav) {
    return DEFAULT_CODEMIRROR_INPUT_STYLE
  }

  // iOS Korean IME uses a fragile contenteditable/beforeinput path in Safari/WebKit.
  // Falling back to the textarea input style avoids broken Hangul composition.
  return isIOSDevice({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints || 0
  }) ? 'textarea' : DEFAULT_CODEMIRROR_INPUT_STYLE
}

export default getCodeMirrorInputStyle
