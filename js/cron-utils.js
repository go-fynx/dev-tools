/**
 * Cron utilities — standard 5-field cron (minute hour day-of-month month day-of-week).
 * Day-of-week: 0 = Sunday … 6 = Saturday (common crontab convention).
 */

(function (global) {
  'use strict';

  /** @type {readonly string[]} */
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  /**
   * @param {number} n
   * @param {number} min
   * @param {number} max
   */
  function clampInt(n, min, max) {
    const x = Math.trunc(Number(n));
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
  }

  /**
   * @param {number} m
   * @param {number} h
   */
  function timeLabel(m, h) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /**
   * Normalize cron string: trim, collapse spaces, require exactly 5 fields.
   * @param {string} raw
   * @returns {string[]|null}
   */
  function splitCronFields(raw) {
    if (typeof raw !== 'string') return null;
    const s = raw.trim().replace(/\s+/g, ' ');
    if (!s) return null;
    const parts = s.split(' ');
    if (parts.length !== 5) return null;
    return parts;
  }

  /**
   * @typedef {object} ScheduleConfig
   * @property {'everyMinutes'|'hourly'|'daily'|'weekly'|'monthly'} type
   * @property {number} [intervalMinutes] - everyMinutes: 1–59
   * @property {number} [minute] - 0–59 (hourly, daily, weekly, monthly)
   * @property {number} [hourInterval] - hourly: 1–23 (default 1 = each hour)
   * @property {number} [hour] - 0–23
   * @property {number|number[]} [day] - weekly: 0–6 or list (0=Sun)
   * @property {number} [dayOfMonth] - monthly: 1–31
   */

  /**
   * Build a 5-field cron expression from structured config.
   * @param {ScheduleConfig} scheduleConfig
   * @returns {string|null} expression or null if invalid
   */
  function generateCron(scheduleConfig) {
    if (!scheduleConfig || typeof scheduleConfig.type !== 'string') return null;
    const pad = (n) => String(n).padStart(2, '0');

    switch (scheduleConfig.type) {
      case 'everyMinutes': {
        const n = clampInt(scheduleConfig.intervalMinutes, 1, 59);
        if (n < 1 || n > 59) return null;
        // */N in minute field = every N minutes
        return `*/${n} * * * *`;
      }
      case 'hourly': {
        const m = clampInt(scheduleConfig.minute, 0, 59);
        const hi = clampInt(scheduleConfig.hourInterval != null ? scheduleConfig.hourInterval : 1, 1, 23);
        if (hi === 1) return `${m} * * * *`;
        // Minute m at every hi-th hour
        return `${m} */${hi} * * *`;
      }
      case 'daily': {
        const h = clampInt(scheduleConfig.hour, 0, 23);
        const mi = clampInt(scheduleConfig.minute, 0, 59);
        return `${mi} ${h} * * *`;
      }
      case 'weekly': {
        const h = clampInt(scheduleConfig.hour, 0, 23);
        const mi = clampInt(scheduleConfig.minute, 0, 59);
        let days = scheduleConfig.day;
        if (days == null && scheduleConfig.days != null) days = scheduleConfig.days;
        if (days == null) return null;
        const arr = Array.isArray(days) ? days : [days];
        const uniq = [...new Set(arr.map((d) => clampInt(d, 0, 6)))].filter((d) => d >= 0 && d <= 6);
        if (uniq.length === 0) return null;
        uniq.sort((a, b) => a - b);
        const dow = uniq.join(',');
        return `${mi} ${h} * * ${dow}`;
      }
      case 'monthly': {
        const dom = clampInt(scheduleConfig.dayOfMonth, 1, 31);
        if (dom < 1 || dom > 31) return null;
        const h = clampInt(scheduleConfig.hour, 0, 23);
        const mi = clampInt(scheduleConfig.minute, 0, 59);
        return `${mi} ${h} ${dom} * *`;
      }
      default:
        return null;
    }
  }

  /**
   * @param {string} field
   * @returns {boolean}
   */
  function isWildcard(field) {
    return field === '*';
  }

  /**
   * Parse step-all field (e.g. minute field "star slash N") — returns n or null.
   * @param {string} field
   * @returns {number|null}
   */
  function parseStepAll(field) {
    const m = /^\*\/(\d+)$/.exec(field);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /**
   * @param {string} field
   * @returns {boolean}
   */
  function isIntegerField(field) {
    return /^\d+$/.test(field);
  }

  /**
   * Parse DOW field into sorted unique indices (0=Sun … 6=Sat).
   * @param {string} dowField
   * @returns {number[]|null} null if invalid token
   */
  function parseDowIndices(dowField) {
    if (dowField === '*') return [];
    const parts = dowField.split(',').map((p) => p.trim()).filter(Boolean);
    const out = [];
    for (const p of parts) {
      const rg = /^(\d)-(\d)$/.exec(p);
      if (rg) {
        const a = clampInt(rg[1], 0, 6);
        const b = clampInt(rg[2], 0, 6);
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.push(i);
        continue;
      }
      if (isIntegerField(p)) {
        out.push(clampInt(p, 0, 6));
      } else {
        return null;
      }
    }
    return [...new Set(out)].sort((a, b) => a - b);
  }

  /**
   * Describe day-of-week field (single value, list, range, or *).
   * @param {string} dowField
   * @returns {string|null}
   */
  function describeDow(dowField) {
    const indices = parseDowIndices(dowField);
    if (indices === null) return null;
    if (indices.length === 0) return null;

    const set = new Set(indices);
    const isWeekdays =
      set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d));
    if (isWeekdays) return 'weekdays';

    const uniq = indices.map((i) => WEEKDAY_NAMES[i]);
    if (uniq.length === 1) return uniq[0];
    if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]}`;
    return uniq.slice(0, -1).join(', ') + ', and ' + uniq[uniq.length - 1];
  }

  /**
   * Turn a 5-field cron expression into short English text.
   * Covers common patterns; other expressions get a structured fallback line.
   * @param {string} cronExpression
   * @returns {string}
   */
  function cronToHuman(cronExpression) {
    const fields = splitCronFields(cronExpression);
    if (!fields) return 'Invalid cron: need exactly five fields (minute hour day-of-month month day-of-week).';

    const [minF, hourF, domF, monthF, dowF] = fields;

    const minStep = parseStepAll(minF);
    if (minStep != null && isWildcard(hourF) && isWildcard(domF) && isWildcard(monthF) && isWildcard(dowF)) {
      if (minStep === 1) return 'Every minute';
      return `Every ${minStep} minutes`;
    }

    const hourStep = parseStepAll(hourF);
    if (
      isIntegerField(minF) &&
      hourStep != null &&
      isWildcard(domF) &&
      isWildcard(monthF) &&
      isWildcard(dowF)
    ) {
      const m = clampInt(minF, 0, 59);
      if (hourStep === 1) return `Every hour at :${String(m).padStart(2, '0')}`;
      return `Every ${hourStep} hours at :${String(m).padStart(2, '0')}`;
    }

    if (
      isIntegerField(minF) &&
      isWildcard(hourF) &&
      isWildcard(domF) &&
      isWildcard(monthF) &&
      isWildcard(dowF)
    ) {
      const m = clampInt(minF, 0, 59);
      return `Every hour at :${String(m).padStart(2, '0')}`;
    }

    if (
      isIntegerField(minF) &&
      isIntegerField(hourF) &&
      isWildcard(domF) &&
      isWildcard(monthF) &&
      isWildcard(dowF)
    ) {
      const m = clampInt(minF, 0, 59);
      const h = clampInt(hourF, 0, 23);
      return `Every day at ${timeLabel(m, h)}`;
    }

    if (
      isIntegerField(minF) &&
      isIntegerField(hourF) &&
      isWildcard(domF) &&
      isWildcard(monthF) &&
      !isWildcard(dowF)
    ) {
      const m = clampInt(minF, 0, 59);
      const h = clampInt(hourF, 0, 23);
      const dowDesc = describeDow(dowF);
      if (dowDesc === 'weekdays') return `Every weekday at ${timeLabel(m, h)}`;
      if (dowDesc) return `Every ${dowDesc} at ${timeLabel(m, h)}`;
      return `At ${timeLabel(m, h)} (day-of-week ${dowF})`;
    }

    if (
      isIntegerField(minF) &&
      isIntegerField(hourF) &&
      !isWildcard(domF) &&
      isWildcard(monthF) &&
      isWildcard(dowF)
    ) {
      const m = clampInt(minF, 0, 59);
      const h = clampInt(hourF, 0, 23);
      const dom = domF;
      return `Every month on day ${dom} at ${timeLabel(m, h)}`;
    }

    // Fallback: show fields readably
    return `Cron: ${minF} ${hourF} ${domF} ${monthF} ${dowF}`;
  }

  const api = {
    generateCron,
    cronToHuman,
    /** Expose for tests or advanced UI */
    WEEKDAY_NAMES,
  };

  global.cronUtils = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
