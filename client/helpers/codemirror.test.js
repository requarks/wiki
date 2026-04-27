import { getCodeMirrorInputStyle, isIOSDevice } from './codemirror'

describe('helpers/codemirror', () => {
  it('detects classic iOS user agents', () => {
    expect(isIOSDevice({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'iPhone',
      maxTouchPoints: 5
    })).toBe(true)
  })

  it('detects iPadOS devices that expose a desktop platform', () => {
    expect(getCodeMirrorInputStyle({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      platform: 'MacIntel',
      maxTouchPoints: 5
    })).toBe('textarea')
  })

  it('keeps the existing contenteditable path on desktop browsers', () => {
    expect(getCodeMirrorInputStyle({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0
    })).toBe('contenteditable')
  })
})
