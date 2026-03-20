/**
 * Epoch converter and timezone utilities (pure functions).
 * Uses Intl.DateTimeFormat for timezone conversion.
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

/** @type {readonly string[]} */
const EPOCH_UNITS = ['seconds', 'ms', 'us', 'ns'];

/**
 * Get supported IANA timezones.
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
 * @param {{ locale?: string, hour12?: boolean }} [options]
 * @returns {{ time12: string, time24: string, date: string }}
 */
function formatInTimezone(date, timezone, options = {}) {
  const locale = options.locale || 'en-US';
  const use12 = options.hour12 !== false;

  const opts = {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  };
  const fmt24 = new Intl.DateTimeFormat(locale, { ...opts, hour12: false });
  const fmt12 = use12
    ? new Intl.DateTimeFormat(locale, { ...opts, hour12: true })
    : fmt24;
  const fmtDate = new Intl.DateTimeFormat(locale, {
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
 * @param {Date} date
 * @returns {string}
 */
function formatIsoUtc(date) {
  return date.toISOString();
}

/**
 * Convert epoch string + unit to milliseconds (UTC instant) and optional sub-ms remainder.
 * @param {string} raw
 * @param {'seconds'|'ms'|'us'|'ns'} unit
 * @returns {{ ok: true, ms: number, extraLabel?: string } | { ok: false, error: string }}
 */
function epochStringToMs(raw, unit) {
  const s = String(raw).trim().replace(/[\s_]/g, '');
  if (s === '') return { ok: false, error: 'Empty input.' };

  const floatOk = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(s);
  const intOk = /^-?\d+$/.test(s);

  if (unit === 'seconds') {
    if (!floatOk) return { ok: false, error: 'Invalid number.' };
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, error: 'Out of range.' };
    const ms = n * 1000;
    if (!Number.isFinite(ms)) return { ok: false, error: 'Out of range.' };
    return { ok: true, ms };
  }

  if (unit === 'ms') {
    if (!floatOk) return { ok: false, error: 'Invalid number.' };
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, error: 'Out of range.' };
    return { ok: true, ms: n };
  }

  if (unit === 'us') {
    if (intOk) {
      try {
        const bi = BigInt(s);
        const msNum = Number(bi / 1000n);
        const rem = Number(bi % 1000n);
        if (!Number.isFinite(msNum)) return { ok: false, error: 'Out of range for Date.' };
        const extra = rem !== 0 ? ` (+ ${rem} µs beyond ms precision)` : undefined;
        return { ok: true, ms: msNum, extraLabel: extra };
      } catch {
        return { ok: false, error: 'Invalid integer.' };
      }
    }
    if (!floatOk) return { ok: false, error: 'Invalid number.' };
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, error: 'Out of range.' };
    return { ok: true, ms: n / 1000 };
  }

  if (unit === 'ns') {
    if (intOk) {
      try {
        const bi = BigInt(s);
        const msNum = Number(bi / 1_000_000n);
        const rem = Number(bi % 1_000_000n);
        if (!Number.isFinite(msNum)) return { ok: false, error: 'Out of range for Date.' };
        const extra = rem !== 0 ? ` (+ ${rem} ns beyond ms precision)` : undefined;
        return { ok: true, ms: msNum, extraLabel: extra };
      } catch {
        return { ok: false, error: 'Invalid integer.' };
      }
    }
    if (!floatOk) return { ok: false, error: 'Invalid number.' };
    const n = Number(s);
    if (!Number.isFinite(n)) return { ok: false, error: 'Out of range.' };
    return { ok: true, ms: n / 1e6 };
  }

  return { ok: false, error: 'Unknown unit.' };
}

/**
 * @param {number} ms
 * @returns {Date | null}
 */
function msToDate(ms) {
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} date
 * @param {'seconds'|'ms'|'us'|'ns'} unit
 * @returns {string}
 */
function dateToEpochString(date, unit) {
  const ms = BigInt(Math.trunc(date.getTime()));
  if (unit === 'seconds') {
    const sec = ms / 1000n;
    const rem = ms % 1000n;
    if (rem === 0n) return sec.toString();
    return (Number(ms) / 1000).toFixed(3).replace(/\.?0+$/, '');
  }
  if (unit === 'ms') return ms.toString();
  if (unit === 'us') return (ms * 1000n).toString();
  if (unit === 'ns') return (ms * 1_000_000n).toString();
  return '';
}

/**
 * Normalize free-text date for Date.parse (strip GMT, collapse spaces).
 * @param {string} text
 * @returns {string}
 */
function normalizeDateParseInput(text) {
  return text
    .trim()
    .replace(/\bGMT\b/gi, 'UTC')
    .replace(/\s+/g, ' ');
}

/**
 * @param {string} text
 * @returns {Date | null}
 */
function parseFlexibleDate(text) {
  const t = normalizeDateParseInput(text);
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

/**
 * @param {Date} day - Any instant on the calendar day (local interpretation for picker)
 * @param {'year'|'month'|'day'} kind
 * @returns {{ start: Date, end: Date }}
 */
function periodBoundsUtcFromPicker(day, kind) {
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();

  let start;
  let end;
  if (kind === 'year') {
    start = new Date(Date.UTC(y, 0, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0));
    end = new Date(end.getTime() - 1);
  } else if (kind === 'month') {
    start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
    end = new Date(end.getTime() - 1);
  } else {
    start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    end = new Date(end.getTime() - 1);
  }
  return { start, end };
}

// --- Specialized: Windows FILETIME (100-ns from 1601-01-01 UTC) ---
const FILETIME_EPOCH_MS = -11644473600000; // 1601-01-01T00:00:00.000Z → Unix ms

/**
 * @param {bigint} filetime - 100-nanosecond intervals since 1601-01-01 UTC
 * @returns {Date | null}
 */
function filetimeToDate(filetime) {
  try {
    const ms = Number(filetime / 10000n) + FILETIME_EPOCH_MS;
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * @param {Date} date
 * @returns {bigint}
 */
function dateToFiletime(date) {
  const ms = BigInt(date.getTime());
  const ft = (ms - BigInt(FILETIME_EPOCH_MS)) * 10000n;
  return ft;
}

// Cocoa / Core Data: seconds since 2001-01-01 00:00:00 UTC
const COCOA_EPOCH_MS = Date.UTC(2001, 0, 1, 0, 0, 0, 0);

/**
 * @param {number} cocoaSeconds
 * @returns {Date | null}
 */
function cocoaSecondsToDate(cocoaSeconds) {
  const ms = cocoaSeconds * 1000 + COCOA_EPOCH_MS;
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} date
 * @returns {number}
 */
function dateToCocoaSeconds(date) {
  return (date.getTime() - COCOA_EPOCH_MS) / 1000;
}

// Chrome/WebKit: microseconds since 1601-01-01 UTC (same as FILETIME / 10)
/**
 * @param {bigint} webkitMicros
 * @returns {Date | null}
 */
function webkitMicrosecondsToDate(webkitMicros) {
  try {
    const ft = webkitMicros * 10n;
    return filetimeToDate(ft);
  } catch {
    return null;
  }
}

/**
 * @param {Date} date
 * @returns {bigint}
 */
function dateToWebkitMicroseconds(date) {
  return dateToFiletime(date) / 10n;
}

// Excel OADate: days since 1899-12-30 (compatibility mode; Excel 1900 leap bug not emulated for serial input)
const EXCEL_OA_EPOCH_MS = Date.UTC(1899, 11, 30, 0, 0, 0, 0);

/**
 * @param {number} oa - serial days (can be fractional)
 * @returns {Date | null}
 */
function oleAutomationDateToDate(oa) {
  if (!Number.isFinite(oa)) return null;
  const ms = oa * 86400 * 1000 + EXCEL_OA_EPOCH_MS;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Date} date
 * @returns {number}
 */
function dateToOleAutomationDate(date) {
  return (date.getTime() - EXCEL_OA_EPOCH_MS) / (86400 * 1000);
}

// Julian Day (UT): midday JD to civil approx (Fliegel & Van Flandern algorithm inverse simplified via formula)
/**
 * Julian date at UTC midnight approximated from JD number (0h UT).
 * @param {number} jd - Julian Day
 * @returns {Date | null}
 */
function julianDayToDate(jd) {
  if (!Number.isFinite(jd)) return null;
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e) + f;
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const dayInt = Math.floor(day);
  const dayFrac = day - dayInt;
  const msInDay = dayFrac * 86400000;
  const utcMs = Date.UTC(year, month - 1, dayInt, 0, 0, 0, 0) + msInDay;
  const d2 = new Date(utcMs);
  return Number.isNaN(d2.getTime()) ? null : d2;
}

/**
 * @param {Date} date - UTC instant
 * @returns {number}
 */
function dateToJulianDay(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d =
    date.getUTCDate() +
    (date.getUTCHours() + (date.getUTCMinutes() + date.getUTCSeconds() / 60) / 60) / 24;
  let a = y;
  let b = m;
  if (m <= 2) {
    a -= 1;
    b += 12;
  }
  const A = Math.floor(a / 100);
  const B = 2 - A + Math.floor(A / 4);
  const jd =
    Math.floor(365.25 * (a + 4716)) +
    Math.floor(30.6001 * (b + 1)) +
    d +
    B -
    1524.5;
  return jd;
}

// Hex Unix epoch (hex string interpreted as integer → seconds or ms based on magnitude heuristics or user choice)
/**
 * @param {string} hex
 * @param {'seconds'|'ms'} mode
 * @returns {Date | null}
 */
function unixHexToDate(hex, mode) {
  const h = hex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]+$/.test(h)) return null;
  let n;
  try {
    n = BigInt('0x' + h);
  } catch {
    return null;
  }
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  const ms = mode === 'ms' ? num : num * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @returns {{ seconds: number, target: Date }}
 */
function year2038Countdown() {
  const target = new Date(Date.UTC(2038, 0, 19, 3, 14, 7, 0));
  const now = new Date();
  const seconds = Math.floor((target.getTime() - now.getTime()) / 1000);
  return { seconds, target };
}

/**
 * @param {string} line
 * @param {'seconds'|'ms'|'us'|'ns'} unit
 * @returns {{ line: string, ok: boolean, iso?: string, error?: string }}
 */
function batchLineToIso(line, unit) {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.startsWith('#')) {
    return { line: trimmed, ok: true };
  }
  const r = epochStringToMs(trimmed, unit);
  if (!r.ok) return { line: trimmed, ok: false, error: r.error };
  const d = msToDate(r.ms);
  if (!d) return { line: trimmed, ok: false, error: 'Invalid date.' };
  return { line: trimmed, ok: true, iso: formatIsoUtc(d) + (r.extraLabel || '') };
}
