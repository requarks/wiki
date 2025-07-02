const INACTIVITY_DAYS_THRESHOLD = 90

function daysAgo(days) {
  return new Date(Date.now() - 1000 * 60 * 60 * 24 * days)
}

function inactivityThresholdDate() {
  return daysAgo(INACTIVITY_DAYS_THRESHOLD)
}

function inactivityThresholdISOString() {
  return inactivityThresholdDate().toISOString()
}

module.exports = {
  INACTIVITY_DAYS_THRESHOLD,
  daysAgo,
  inactivityThresholdDate,
  inactivityThresholdISOString
}
