const {
  INACTIVITY_DAYS_THRESHOLD,
  daysAgo,
  inactivityThresholdDate,
  inactivityThresholdISOString
} = require('../../helpers/dateHelpers')

describe('dateHelpers', () => {
  it('daysAgo should return a date N days in the past', () => {
    const now = Date.now()
    const fiveDaysAgo = daysAgo(5)
    const diff = now - fiveDaysAgo.getTime()
    // Allow a small margin for test execution time
    expect(diff).toBeGreaterThanOrEqual(1000 * 60 * 60 * 24 * 5 - 10000) // allow 10s margin
    expect(diff).toBeLessThan(1000 * 60 * 60 * 24 * 5 + 10000)
  })

  it('inactivityThresholdDate should return a date N days in the past', () => {
  const now = Date.now()
  const thresholdDate = inactivityThresholdDate()
  const diff = now - thresholdDate.getTime()
  // Allow 1ms tolerance for timing precision
  expect(diff).toBeGreaterThanOrEqual(1000 * 60 * 60 * 24 * INACTIVITY_DAYS_THRESHOLD - 1)
  expect(diff).toBeLessThan(1000 * 60 * 60 * 24 * INACTIVITY_DAYS_THRESHOLD + 1000 * 10)
  })

  it('inactivityThresholdISOString should return a valid ISO string for N days ago', () => {
    const isoString = inactivityThresholdISOString()
    const date = new Date(isoString)
    const now = Date.now()
    const diff = now - date.getTime()
    expect(typeof isoString).toBe('string')
    expect(diff).toBeGreaterThanOrEqual(1000 * 60 * 60 * 24 * INACTIVITY_DAYS_THRESHOLD)
    expect(diff).toBeLessThan(1000 * 60 * 60 * 24 * INACTIVITY_DAYS_THRESHOLD + 1000 * 10)
  })
})
