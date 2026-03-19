/**
 * Epoch converter and timezone utilities
 * Uses Intl.DateTimeFormat for timezone conversion
 */

/**
 * Critical timezones that may be missing from Intl.supportedValuesOf in Chrome/Chromium.
 * @see https://github.com/tc39/proposal-temporal/issues/3249
 */
const CRITICAL_TIMEZONES = [
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Asia/Tokyo',
];

const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

/**
 * Get supported IANA timezones.
 * Merges Intl.supportedValuesOf with critical timezones (e.g. Asia/Kolkata)
 * that Chrome/Chromium may omit due to ICU bugs.
 * @returns {string[]}
 */
function getTimezones() {
  let list;
  if (typeof Intl.supportedValuesOf === 'function') {
    list = Intl.supportedValuesOf('timeZone');
  } else {
    list = FALLBACK_TIMEZONES;
  }
  const merged = [...new Set([...CRITICAL_TIMEZONES, ...list])];
  return merged.sort((a, b) => a.localeCompare(b));
}

/**
 * Format time in timezone
 * @param {Date} date
 * @param {string} timezone
 * @param {Object} options
 * @returns {{ time12: string, time24: string, date: string }}
 */
function formatInTimezone(date, timezone, options = {}) {
  const opts = {
    timeZone: timezone,
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  };
  const fmt12 = new Intl.DateTimeFormat('en-US', { ...opts, hour12: true });
  const fmt24 = new Intl.DateTimeFormat('en-US', { ...opts, hour12: false });
  const fmtDate = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    dateStyle: 'medium',
  });
  return {
    time12: fmt12.format(date),
    time24: fmt24.format(date),
    date: fmtDate.format(date),
  };
}

/**
 * Convert epoch (seconds or ms) to Date
 * @param {number} epoch
 * @param {boolean} isMilliseconds
 * @returns {Date}
 */
function epochToDate(epoch, isMilliseconds) {
  const ms = isMilliseconds ? epoch : epoch * 1000;
  return new Date(ms);
}

/**
 * Convert Date to epoch
 * @param {Date} date
 * @param {boolean} asMilliseconds
 * @returns {number}
 */
function dateToEpoch(date, asMilliseconds) {
  return asMilliseconds ? date.getTime() : Math.floor(date.getTime() / 1000);
}
