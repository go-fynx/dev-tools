/**
 * Format a duration in nanoseconds (same unit as Go's time.Duration) as a human-readable string.
 *
 * Examples:
 * - 996_320_000 → "996.32 ms"
 * - 2e9 → "2 sec"
 * - 65e9 → "1 min 5 sec"
 * - (1*3600 + 2*60 + 3) * 1e9 → "1 hr 2 min 3 sec"
 *
 * Supports BigInt-sized values. Negative durations get a leading "-".
 *
 * @param {bigint | number | string} ns - Nanoseconds; string may contain underscores/spaces.
 * @returns {string}
 */
function formatDurationNanoseconds(ns) {
  const parsed = parseDurationNanosInput(ns);
  if (parsed.error) {
    return parsed.error;
  }
  return formatDurationNanosecondsFromParsed(parsed);
}

/**
 * @param {{ value: bigint, negative: boolean }} parsed
 * @returns {string}
 */
function formatDurationNanosecondsFromParsed(parsed) {
  const { value: n, negative } = parsed;
  if (n === 0n) {
    return negative ? '-0 ms' : '0 ms';
  }

  const abs = n;
  const core = formatDurationNanosecondsAbs(abs);
  return negative ? `-${core}` : core;
}

/**
 * Structured result for UI (avoids parsing error strings).
 * @param {bigint | number | string} input
 * @returns {{ ok: true, text: string } | { ok: false, error: string }}
 */
function tryFormatDurationNanoseconds(input) {
  const raw = typeof input === 'string' ? input.trim() : input;
  const parsed = parseDurationNanosInput(raw);
  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }
  return { ok: true, text: formatDurationNanosecondsFromParsed(parsed) };
}

/**
 * @param {bigint | number | string} ns
 * @returns {{ value: bigint, negative: boolean } | { error: string }}
 */
function parseDurationNanosInput(ns) {
  if (typeof ns === 'bigint') {
    if (ns === 0n) return { value: 0n, negative: false };
    const negative = ns < 0n;
    return { value: negative ? -ns : ns, negative };
  }

  if (typeof ns === 'number') {
    if (!Number.isFinite(ns) || !Number.isInteger(ns)) {
      return { error: 'Invalid duration (use integer nanoseconds)' };
    }
    if (!Number.isSafeInteger(ns)) {
      return { error: 'Duration too large for number; pass a string of digits' };
    }
    const negative = ns < 0;
    const value = BigInt(Math.abs(ns));
    return { value, negative };
  }

  let s = String(ns).trim().replace(/_/g, '').replace(/\s/g, '');
  if (s === '' || s === '+' || s === '-') {
    return { error: 'Invalid duration' };
  }

  let negative = false;
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }

  if (!/^\d+$/.test(s)) {
    return { error: 'Invalid duration (use integer nanoseconds)' };
  }

  try {
    const value = BigInt(s);
    return { value, negative };
  } catch {
    return { error: 'Invalid duration (value too large or bad format)' };
  }
}

const NS_PER_US = 1000n;
const NS_PER_MS = 1_000_000n;
const NS_PER_S = 1_000_000_000n;
const NS_PER_MIN = 60n * NS_PER_S;
const NS_PER_HOUR = 3600n * NS_PER_S;
const NS_PER_DAY = 24n * NS_PER_HOUR;

/**
 * @param {bigint} absNs - Absolute nanoseconds, > 0
 * @returns {string}
 */
function formatDurationNanosecondsAbs(absNs) {
  if (absNs < NS_PER_S) {
    return formatSubSecond(absNs);
  }

  const days = absNs / NS_PER_DAY;
  let rem = absNs % NS_PER_DAY;

  const hours = rem / NS_PER_HOUR;
  rem %= NS_PER_HOUR;

  const minutes = rem / NS_PER_MIN;
  rem %= NS_PER_MIN;

  const wholeSec = rem / NS_PER_S;
  const fracNs = rem % NS_PER_S;

  const parts = [];

  if (days > 0n) {
    parts.push(`${days} ${days === 1n ? 'day' : 'days'}`);
  }
  if (hours > 0n) {
    parts.push(`${hours} hr`);
  }
  if (minutes > 0n) {
    parts.push(`${minutes} min`);
  }

  const secStr = formatSecondsPart(wholeSec, fracNs);
  if (secStr !== null) {
    parts.push(secStr);
  } else if (parts.length === 0) {
    parts.push('0 sec');
  }

  return parts.join(' ');
}

/**
 * @param {bigint} absNs
 * @returns {string}
 */
function formatSubSecond(absNs) {
  if (absNs === 0n) {
    return '0 ms';
  }
  if (absNs < NS_PER_US) {
    return `${absNs} ns`;
  }

  const wholeMs = absNs / NS_PER_MS;
  const fracNs = absNs % NS_PER_MS;
  return formatDecimalFromParts(wholeMs, fracNs, 6, 'ms');
}

/**
 * @param {bigint} whole
 * @param {bigint} fracNumerator - numerator / denom = fractional part
 * @param {number} denom - 10^decimals for the fractional part
 * @param {string} unit
 */
function formatDecimalFromParts(whole, fracNumerator, denomDigits, unit) {
  const denom = 10n ** BigInt(denomDigits);
  if (fracNumerator === 0n) {
    return `${whole} ${unit}`;
  }
  const fracStr = String(fracNumerator).padStart(denomDigits, '0').replace(/0+$/, '');
  if (fracStr.length === 0) {
    return `${whole} ${unit}`;
  }
  return `${whole}.${fracStr} ${unit}`;
}

/**
 * @param {bigint} wholeSec
 * @param {bigint} fracNs
 * @returns {string | null} null if both zero (caller may omit)
 */
function formatSecondsPart(wholeSec, fracNs) {
  if (wholeSec === 0n && fracNs === 0n) {
    return null;
  }
  if (fracNs === 0n) {
    return `${wholeSec} sec`;
  }
  const fracStr = String(fracNs).padStart(9, '0').replace(/0+$/, '');
  if (wholeSec === 0n) {
    return `0.${fracStr} sec`;
  }
  return `${wholeSec}.${fracStr} sec`;
}
