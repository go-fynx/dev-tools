/**
 * Epoch converter hub — binds DOM for epoch-converter/index.html
 */
(function () {
  'use strict';

  const PREFS_KEY = 'epoch-converter-prefs';
  const ALERT_PREFS_KEY = 'epoch-converter-alerts';

  /** @type {{ utcHour: string, utcAlarm: string, localHour: string, localAlarm: string }} */
  let alertDedupe = { utcHour: '', utcAlarm: '', localHour: '', localAlarm: '' };

  /** @returns {{ locale: string, hour12: boolean }} */
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return { locale: 'en-US', hour12: true };
      const p = JSON.parse(raw);
      return {
        locale: p.locale || 'en-US',
        hour12: p.hour12 !== false,
      };
    } catch {
      return { locale: 'en-US', hour12: true };
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function getFormatOpts() {
    const p = loadPrefs();
    return { locale: p.locale, hour12: p.hour12 };
  }

  function formatAll(date, tz) {
    const o = getFormatOpts();
    const base = formatInTimezone(date, tz, o);
    return {
      ...base,
      iso: formatIsoUtc(date),
    };
  }

  function $(id) {
    return document.getElementById(id);
  }

  function initTabs() {
    const buttons = document.querySelectorAll('[data-tab-target]');
    const panels = document.querySelectorAll('[data-tab-panel]');
    function activate(name) {
      buttons.forEach((b) => {
        const on = b.getAttribute('data-tab-target') === name;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      panels.forEach((p) => {
        const on = p.getAttribute('data-tab-panel') === name;
        p.setAttribute('aria-hidden', on ? 'false' : 'true');
      });
      try {
        localStorage.setItem('epoch-converter-active-tab', name);
      } catch (_) {}
    }
    buttons.forEach((b) => {
      b.addEventListener('click', () => activate(b.getAttribute('data-tab-target')));
    });
    const saved = localStorage.getItem('epoch-converter-active-tab') || 'core';
    if (document.querySelector('[data-tab-target="' + saved + '"]')) activate(saved);
    else activate('core');
  }

  function populateTimezones(selectIds) {
    const tzList = getTimezones();
    const options = tzList.map((tz) => `<option value="${tz}">${tz}</option>`).join('');
    selectIds.forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = options;
    });
  }

  function getLocalTimeZoneId() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    } catch {
      return 'local';
    }
  }

  function formatLocalTzLabel(now) {
    const id = getLocalTimeZoneId();
    try {
      const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'shortOffset' }).formatToParts(now);
      const tzPart = parts.find((p) => p.type === 'timeZoneName');
      return tzPart && tzPart.value ? `${id} · ${tzPart.value}` : id;
    } catch {
      return id;
    }
  }

  function tickClocks() {
    const now = new Date();
    const utc = 'UTC';
    const fmt = formatAll(now, utc);

    const h12 = $('time-12h');
    const h24 = $('time-24h');
    if (h12) h12.textContent = fmt.time12;
    if (h24) h24.textContent = fmt.time24;

    const sec = now.getUTCSeconds();
    const min = now.getUTCMinutes();
    const hour = now.getUTCHours() % 12;
    const secDeg = (sec / 60) * 360;
    const minDeg = (min / 60) * 360 + (sec / 60) * 6;
    const hourDeg = (hour / 12) * 360 + (min / 60) * 30;
    const hs = $('hand-second');
    const hm = $('hand-minute');
    const hh = $('hand-hour');
    if (hs) hs.style.transform = `rotate(${secDeg}deg)`;
    if (hm) hm.style.transform = `rotate(${minDeg}deg)`;
    if (hh) hh.style.transform = `rotate(${hourDeg}deg)`;

    const epS = $('epoch-live-seconds');
    const epMs = $('epoch-live-ms');
    const secStr = String(Math.floor(now.getTime() / 1000));
    const msStr = String(now.getTime());
    if (epS) epS.value = secStr;
    if (epMs) epMs.value = msStr;

    const localTz = getLocalTimeZoneId();
    const fmtLocal = formatAll(now, localTz);
    const l12 = $('time-local-12h');
    const l24 = $('time-local-24h');
    if (l12) l12.textContent = fmtLocal.time12;
    if (l24) l24.textContent = fmtLocal.time24;
    const tzLoc = $('tz-local-label');
    if (tzLoc) tzLoc.textContent = formatLocalTzLabel(now);

    const secL = now.getSeconds();
    const minL = now.getMinutes();
    const hourL = now.getHours() % 12;
    const secDegL = (secL / 60) * 360;
    const minDegL = (minL / 60) * 360 + (secL / 60) * 6;
    const hourDegL = (hourL / 12) * 360 + (minL / 60) * 30;
    const hsl = $('hand-second-local');
    const hml = $('hand-minute-local');
    const hhl = $('hand-hour-local');
    if (hsl) hsl.style.transform = `rotate(${secDegL}deg)`;
    if (hml) hml.style.transform = `rotate(${minDegL}deg)`;
    if (hhl) hhl.style.transform = `rotate(${hourDegL}deg)`;

    const epSL = $('epoch-live-seconds-local');
    const epMsL = $('epoch-live-ms-local');
    if (epSL) epSL.value = secStr;
    if (epMsL) epMsL.value = msStr;
  }

  function tickMsOnly() {
    const now = new Date();
    const msStr = String(now.getTime());
    const epMs = $('epoch-live-ms');
    if (epMs) epMs.value = msStr;
    const epMsL = $('epoch-live-ms-local');
    if (epMsL) epMsL.value = msStr;
    checkAlerts(now);
  }

  /**
   * @param {string} timeVal - HTML time value "HH:MM"
   * @returns {{ h: number, m: number }}
   */
  function parseAlertTime(timeVal) {
    const s = String(timeVal || '').trim();
    const m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) return { h: 9, m: 0 };
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return { h: 9, m: 0 };
    return { h: Math.min(23, Math.max(0, h)), m: Math.min(59, Math.max(0, min)) };
  }

  function fireNotification(title, body) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body });
    } catch (_) {}
  }

  function checkAlerts(now) {
    const utcOn = $('alert-utc-on') && $('alert-utc-on').checked;
    const localOn = $('alert-local-on') && $('alert-local-on').checked;
    if (!utcOn && !localOn) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const uy = now.getUTCFullYear();
    const umo = now.getUTCMonth();
    const ud = now.getUTCDate();
    const uh = now.getUTCHours();
    const um = now.getUTCMinutes();
    const us = now.getUTCSeconds();

    if (utcOn) {
      const mode = $('alert-utc-mode') && $('alert-utc-mode').value;
      if (mode === 'hourly') {
        if (um === 0 && us === 0) {
          const key = `u-h-${uy}-${umo}-${ud}-${uh}`;
          if (key !== alertDedupe.utcHour) {
            alertDedupe.utcHour = key;
            fireNotification('Epoch converter — UTC', `Top of the hour (${String(uh).padStart(2, '0')}:00 UTC).`);
          }
        }
      } else {
        const { h: th, m: tm } = parseAlertTime($('alert-utc-time') && $('alert-utc-time').value);
        if (uh === th && um === tm && us === 0) {
          const key = `u-a-${uy}-${umo}-${ud}`;
          if (key !== alertDedupe.utcAlarm) {
            alertDedupe.utcAlarm = key;
            fireNotification(
              'Epoch converter — UTC alarm',
              `Daily UTC time reached: ${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')}.`
            );
          }
        }
      }
    }

    const ly = now.getFullYear();
    const lmo = now.getMonth();
    const ld = now.getDate();
    const lh = now.getHours();
    const lm = now.getMinutes();
    const ls = now.getSeconds();

    if (localOn) {
      const mode = $('alert-local-mode') && $('alert-local-mode').value;
      if (mode === 'hourly') {
        if (lm === 0 && ls === 0) {
          const key = `l-h-${ly}-${lmo}-${ld}-${lh}`;
          if (key !== alertDedupe.localHour) {
            alertDedupe.localHour = key;
            fireNotification(
              'Epoch converter — local',
              `Top of the hour (${String(lh).padStart(2, '0')}:00 ${getLocalTimeZoneId()}).`
            );
          }
        }
      } else {
        const { h: th, m: tm } = parseAlertTime($('alert-local-time') && $('alert-local-time').value);
        if (lh === th && lm === tm && ls === 0) {
          const key = `l-a-${ly}-${lmo}-${ld}`;
          if (key !== alertDedupe.localAlarm) {
            alertDedupe.localAlarm = key;
            fireNotification(
              'Epoch converter — local alarm',
              `Daily local time reached: ${String(th).padStart(2, '0')}:${String(tm).padStart(2, '0')} (${getLocalTimeZoneId()}).`
            );
          }
        }
      }
    }
  }

  function updateAlertTimeVisibility() {
    const utcMode = $('alert-utc-mode');
    const locMode = $('alert-local-mode');
    const uw = $('alert-utc-time-wrap');
    const lw = $('alert-local-time-wrap');
    if (uw) uw.hidden = !utcMode || utcMode.value !== 'alarm';
    if (lw) lw.hidden = !locMode || locMode.value !== 'alarm';
  }

  function refreshAlertPermissionStatus() {
    const el = $('alert-permission-status');
    if (!el) return;
    if (typeof Notification === 'undefined') {
      el.textContent = 'Notifications are not supported in this context (use HTTPS or localhost).';
      return;
    }
    if (Notification.permission === 'granted') {
      el.textContent = 'Notifications are allowed.';
    } else if (Notification.permission === 'denied') {
      el.textContent = 'Notifications are blocked. Change site permissions in the browser to enable.';
    } else {
      el.textContent = 'Click “Allow notifications” so hourly and alarm alerts can appear.';
    }
  }

  /** @returns {{ utcOn: boolean, utcMode: string, utcTime: string, localOn: boolean, localMode: string, localTime: string }} */
  function loadAlertPrefs() {
    try {
      const raw = localStorage.getItem(ALERT_PREFS_KEY);
      if (!raw) {
        return {
          utcOn: false,
          utcMode: 'hourly',
          utcTime: '09:00',
          localOn: false,
          localMode: 'hourly',
          localTime: '09:00',
        };
      }
      const p = JSON.parse(raw);
      return {
        utcOn: !!p.utcOn,
        utcMode: p.utcMode === 'alarm' ? 'alarm' : 'hourly',
        utcTime: typeof p.utcTime === 'string' && p.utcTime ? p.utcTime : '09:00',
        localOn: !!p.localOn,
        localMode: p.localMode === 'alarm' ? 'alarm' : 'hourly',
        localTime: typeof p.localTime === 'string' && p.localTime ? p.localTime : '09:00',
      };
    } catch {
      return {
        utcOn: false,
        utcMode: 'hourly',
        utcTime: '09:00',
        localOn: false,
        localMode: 'hourly',
        localTime: '09:00',
      };
    }
  }

  function saveAlertPrefsFromDom() {
    try {
      localStorage.setItem(
        ALERT_PREFS_KEY,
        JSON.stringify({
          utcOn: $('alert-utc-on') && $('alert-utc-on').checked,
          utcMode: ($('alert-utc-mode') && $('alert-utc-mode').value) || 'hourly',
          utcTime: ($('alert-utc-time') && $('alert-utc-time').value) || '09:00',
          localOn: $('alert-local-on') && $('alert-local-on').checked,
          localMode: ($('alert-local-mode') && $('alert-local-mode').value) || 'hourly',
          localTime: ($('alert-local-time') && $('alert-local-time').value) || '09:00',
        })
      );
    } catch (_) {}
  }

  function bindAlerts() {
    if (!$('alert-utc-on')) return;

    const ap = loadAlertPrefs();
    const uOn = $('alert-utc-on');
    const uMode = $('alert-utc-mode');
    const uTime = $('alert-utc-time');
    const lOn = $('alert-local-on');
    const lMode = $('alert-local-mode');
    const lTime = $('alert-local-time');
    if (uOn) uOn.checked = ap.utcOn;
    if (uMode) uMode.value = ap.utcMode;
    if (uTime) uTime.value = ap.utcTime;
    if (lOn) lOn.checked = ap.localOn;
    if (lMode) lMode.value = ap.localMode;
    if (lTime) lTime.value = ap.localTime;
    updateAlertTimeVisibility();
    refreshAlertPermissionStatus();

    function persistAlerts() {
      saveAlertPrefsFromDom();
      alertDedupe = { utcHour: '', utcAlarm: '', localHour: '', localAlarm: '' };
    }

    [uOn, uMode, uTime, lOn, lMode, lTime].forEach((el) => {
      if (el) el.addEventListener('change', persistAlerts);
    });
    if (uMode) uMode.addEventListener('change', updateAlertTimeVisibility);
    if (lMode) lMode.addEventListener('change', updateAlertTimeVisibility);

    const btn = $('btn-alert-permission');
    if (btn) {
      btn.addEventListener('click', async () => {
        if (typeof Notification === 'undefined') {
          refreshAlertPermissionStatus();
          return;
        }
        try {
          await Notification.requestPermission();
        } catch (_) {}
        refreshAlertPermissionStatus();
      });
    }
  }

  function clearAllForms() {
    const clears = [
      'epoch-input',
      'epoch-output-utc',
      'epoch-output-tz',
      'epoch-output-iso',
      'date-text-input',
      'date-epoch-output',
      'batch-input',
      'spec-filetime',
      'spec-cocoa',
      'spec-webkit',
      'spec-oa',
      'spec-jd',
      'spec-hex',
      'duration-input',
      'list-output',
    ];
    clears.forEach((id) => {
      const el = $(id);
      if (el) el.value = '';
    });
    const v = $('epoch-validation');
    if (v) v.textContent = '';
    const dv = $('date-epoch-validation');
    if (dv) dv.textContent = '';
    const bw = $('batch-output-wrap');
    if (bw) bw.innerHTML = '';
    const du = $('duration-out');
    if (du) du.innerHTML = '';
  }

  function bindPrefs() {
    const p = loadPrefs();
    const loc = $('pref-locale');
    const h12 = $('pref-hour12');
    if (loc) loc.value = p.locale;
    if (h12) h12.checked = p.hour12;

    function persist() {
      savePrefs({
        locale: loc ? loc.value : 'en-US',
        hour12: h12 ? h12.checked : true,
      });
      tickClocks();
    }
    if (loc) loc.addEventListener('change', persist);
    if (h12) h12.addEventListener('change', persist);
  }

  function bindTimezoneConvert() {
    const btn = $('btn-convert-tz');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const tz = $('tz-select').value;
      const now = new Date();
      const fmt = formatAll(now, tz);
      $('tz-time-12').textContent = fmt.time12;
      $('tz-time-24').textContent = fmt.time24;
      $('tz-date').textContent = fmt.date;
      $('tz-output-copy').value = `${fmt.date} ${fmt.time24} (${tz})`;
      $('tz-iso').textContent = formatIsoUtc(now);
      $('tz-result').style.display = 'grid';
    });
    $('btn-copy-tz') &&
      $('btn-copy-tz').addEventListener('click', async () => {
        const t = $('tz-output-copy').value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-copy-tz'), ok ? 'Copied!' : 'Failed', 1500);
      });
  }

  function bindEpochToHuman() {
    const btn = $('btn-epoch-convert');
    if (!btn) return;
    const valEl = $('epoch-validation');
    btn.addEventListener('click', () => {
      const raw = $('epoch-input').value.trim();
      const unit = document.querySelector('input[name="epoch-unit"]:checked').value;
      const tz = $('epoch-tz').value;
      if (!raw) {
        valEl.textContent = 'Please enter an epoch timestamp.';
        valEl.className = 'validation-msg error';
        return;
      }
      const r = epochStringToMs(raw, unit);
      if (!r.ok) {
        valEl.textContent = r.error;
        valEl.className = 'validation-msg error';
        return;
      }
      const d = msToDate(r.ms);
      if (!d) {
        valEl.textContent = 'Invalid date (out of range).';
        valEl.className = 'validation-msg error';
        return;
      }
      const utcFmt = formatAll(d, 'UTC');
      const tzFmt = formatAll(d, tz);
      $('epoch-output-utc').value = `${utcFmt.date} ${utcFmt.time24} (UTC)`;
      $('epoch-output-tz').value = `${tzFmt.date} ${tzFmt.time24} (${tz})`;
      let iso = formatIsoUtc(d);
      if (r.extraLabel) iso += r.extraLabel;
      $('epoch-output-iso').value = iso;
      valEl.textContent = 'Converted successfully.';
      valEl.className = 'validation-msg success';
    });

    [
      ['btn-copy-epoch-utc', () => $('epoch-output-utc').value],
      ['btn-copy-epoch-tz', () => $('epoch-output-tz').value],
      ['btn-copy-epoch-iso', () => $('epoch-output-iso').value],
    ].forEach(([id, getVal]) => {
      const b = $(id);
      if (!b) return;
      b.addEventListener('click', async () => {
        const t = getVal();
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback(b, ok ? 'Copied!' : 'Failed', 1500);
      });
    });
  }

  function bindHumanToEpoch() {
    const btn = $('btn-date-to-epoch');
    if (!btn) return;
    const out = $('date-epoch-output');
    const err = $('date-epoch-validation');

    function run() {
      let date = null;
      const text = $('date-text-input') && $('date-text-input').value.trim();
      if (text) {
        date = parseFlexibleDate(text);
        if (!date) {
          err.textContent = 'Could not parse text date. Try ISO 8601 or RFC 2822 style.';
          err.className = 'validation-msg error';
          out.value = '';
          return;
        }
      } else {
        const local = $('date-input').value;
        if (!local) {
          out.value = '';
          err.textContent = '';
          return;
        }
        date = new Date(local);
        if (Number.isNaN(date.getTime())) {
          err.textContent = 'Invalid datetime-local value.';
          err.className = 'validation-msg error';
          return;
        }
      }
      const unit = document.querySelector('input[name="date-epoch-unit"]:checked').value;
      out.value = dateToEpochString(date, unit);
      err.textContent = 'OK.';
      err.className = 'validation-msg success';
    }

    btn.addEventListener('click', run);
    $('date-input') && $('date-input').addEventListener('change', run);
    $('btn-copy-date-epoch') &&
      $('btn-copy-date-epoch').addEventListener('click', async () => {
        const t = out.value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-copy-date-epoch'), ok ? 'Copied!' : 'Failed', 1500);
      });
  }

  function bindPeriod() {
    const btn = $('btn-period');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const kind = $('period-kind').value;
      const dStr = $('period-date').value;
      if (!dStr) return;
      const parts = dStr.split('-').map(Number);
      const day = new Date(parts[0], parts[1] - 1, parts[2]);
      const { start, end } = periodBoundsUtcFromPicker(day, kind);
      const tz = $('period-tz').value;
      const unit = $('period-unit').value;
      const fs = (dt) => formatAll(dt, tz);
      $('period-start-human').textContent =
        fs(start).date + ' ' + fs(start).time24 + ' (' + tz + ')';
      $('period-end-human').textContent =
        fs(end).date + ' ' + fs(end).time24 + ' (' + tz + ')';
      $('period-start-epoch').value = dateToEpochString(start, unit);
      $('period-end-epoch').value = dateToEpochString(end, unit);
    });
    $('btn-copy-period-start') &&
      $('btn-copy-period-start').addEventListener('click', async () => {
        const t = $('period-start-epoch').value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-copy-period-start'), ok ? 'Copied!' : 'Failed', 1500);
      });
    $('btn-copy-period-end') &&
      $('btn-copy-period-end').addEventListener('click', async () => {
        const t = $('period-end-epoch').value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-copy-period-end'), ok ? 'Copied!' : 'Failed', 1500);
      });
  }

  function bindDuration() {
    const btn = $('btn-duration');
    const out = $('duration-out');
    if (!btn || !out) return;
    btn.addEventListener('click', () => {
      const raw = $('duration-input').value.trim();
      const r = tryFormatDurationNanoseconds(raw);
      if (!r.ok) {
        out.innerHTML = `<span class="validation-msg error">${escapeHtml(r.error)}</span>`;
        return;
      }
      out.innerHTML =
        `<p class="mono-out duration-result"><strong>${escapeHtml(r.text)}</strong></p>` +
        '<p class="fine-print">Input is nanoseconds (Go <code>time.Duration</code>). Reusable API: <code>formatDurationNanoseconds(ns)</code> in <code>js/format-go-duration.js</code>.</p>';
    });
  }

  function bindBatch() {
    const btn = $('btn-batch');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const unit = $('batch-unit').value;
      const lines = $('batch-input').value.split(/\r?\n/);
      const wrap = $('batch-output-wrap');
      wrap.innerHTML = '';
      const table = document.createElement('table');
      table.className = 'data-table';
      table.innerHTML =
        '<thead><tr><th>Input</th><th>Result</th></tr></thead><tbody></tbody>';
      const tb = table.querySelector('tbody');
      for (const line of lines) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const r = batchLineToIso(line, unit);
        const tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' +
          escapeHtml(line) +
          '</code></td><td>' +
          (r.ok && r.iso
            ? '<code>' + escapeHtml(r.iso) + '</code>'
            : '<span class="validation-msg error">' + escapeHtml(r.error || 'Error') + '</span>') +
          '</td>';
        tb.appendChild(tr);
      }
      wrap.appendChild(table);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function bindList() {
    const btn = $('btn-list-gen');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const y = Number($('list-year').value);
      const m = Number($('list-month').value);
      const step = $('list-step').value;
      if (!Number.isFinite(y) || !Number.isFinite(m)) return;
      const out = [];
      let cur = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      const end = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const inc = step === 'hourly' ? 3600000 : 86400000;
      while (cur.getTime() < end.getTime()) {
        out.push(String(Math.floor(cur.getTime() / 1000)) + ',' + formatIsoUtc(cur));
        cur = new Date(cur.getTime() + inc);
      }
      $('list-output').value = out.join('\n');
    });
    $('btn-list-copy') &&
      $('btn-list-copy').addEventListener('click', async () => {
        const t = $('list-output').value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-list-copy'), ok ? 'Copied!' : 'Failed', 1500);
      });
  }

  function bindSpecial() {
    $('btn-spec-filetime') &&
      $('btn-spec-filetime').addEventListener('click', () => {
        const raw = $('spec-filetime').value.trim().replace(/\s/g, '');
        try {
          const bi = BigInt(raw);
          const d = filetimeToDate(bi);
          $('spec-filetime-out').textContent = d ? formatIsoUtc(d) : 'Invalid';
        } catch {
          $('spec-filetime-out').textContent = 'Invalid integer';
        }
      });
    $('btn-spec-cocoa') &&
      $('btn-spec-cocoa').addEventListener('click', () => {
        const n = Number($('spec-cocoa').value);
        const d = cocoaSecondsToDate(n);
        $('spec-cocoa-out').textContent = d ? formatIsoUtc(d) : 'Invalid';
      });
    $('btn-spec-webkit') &&
      $('btn-spec-webkit').addEventListener('click', () => {
        const raw = $('spec-webkit').value.trim();
        try {
          const d = webkitMicrosecondsToDate(BigInt(raw));
          $('spec-webkit-out').textContent = d ? formatIsoUtc(d) : 'Invalid';
        } catch {
          $('spec-webkit-out').textContent = 'Invalid';
        }
      });
    $('btn-spec-oa') &&
      $('btn-spec-oa').addEventListener('click', () => {
        const n = Number($('spec-oa').value);
        const d = oleAutomationDateToDate(n);
        $('spec-oa-out').textContent = d ? formatIsoUtc(d) : 'Invalid';
      });
    $('btn-spec-jd') &&
      $('btn-spec-jd').addEventListener('click', () => {
        const n = Number($('spec-jd').value);
        const d = julianDayToDate(n);
        $('spec-jd-out').textContent = d ? formatIsoUtc(d) : 'Invalid';
      });
    $('btn-spec-hex') &&
      $('btn-spec-hex').addEventListener('click', () => {
        const hex = $('spec-hex').value;
        const mode = $('spec-hex-mode').value;
        const d = unixHexToDate(hex, mode);
        $('spec-hex-out').textContent = d ? formatIsoUtc(d) : 'Invalid';
      });
  }

  function bindY2038() {
    function upd() {
      const { seconds, target } = year2038Countdown();
      const el = $('y2038-countdown');
      if (!el) return;
      if (seconds < 0) {
        el.textContent = 'The 32-bit signed seconds epoch range has passed for that instant (educational reference only).';
        return;
      }
      const d = Math.floor(seconds / 86400);
      const h = Math.floor((seconds % 86400) / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      el.textContent = `${d}d ${h}h ${m}m ${s}s until ${formatIsoUtc(target)} (UTC)`;
    }

    upd();
    setInterval(upd, 1000);
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'c' && e.key !== 'C') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'))
        return;
      e.preventDefault();
      clearAllForms();
    });
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function initDateDefaults() {
    const di = $('date-input');
    if (!di) return;
    const d = new Date();
    di.value =
      d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function init() {
    initTabs();
    populateTimezones(['tz-select', 'epoch-tz', 'period-tz']);
    bindPrefs();
    bindAlerts();
    tickClocks();
    setInterval(tickClocks, 1000);
    setInterval(tickMsOnly, 100);
    bindTimezoneConvert();
    bindEpochToHuman();
    bindHumanToEpoch();
    bindPeriod();
    bindDuration();
    bindBatch();
    bindList();
    bindSpecial();
    bindY2038();
    bindKeyboard();
    initDateDefaults();
    $('btn-clear-all') &&
      $('btn-clear-all').addEventListener('click', () => clearAllForms());

    [
      ['btn-copy-live-s', () => $('epoch-live-seconds').value],
      ['btn-copy-live-ms', () => $('epoch-live-ms').value],
      ['btn-copy-live-s-local', () => $('epoch-live-seconds-local').value],
      ['btn-copy-live-ms-local', () => $('epoch-live-ms-local').value],
    ].forEach(([id, fn]) => {
      const b = $(id);
      if (!b) return;
      b.addEventListener('click', async () => {
        const t = fn();
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback(b, ok ? 'Copied!' : 'Failed', 1500);
      });
    });
  }

  if (document.getElementById('epoch-hub')) {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
