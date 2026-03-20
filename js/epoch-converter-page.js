/**
 * Epoch converter hub — binds DOM for epoch-converter/index.html
 */
(function () {
  'use strict';

  const PREFS_KEY = 'epoch-converter-prefs';

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
    if (epS) epS.textContent = String(Math.floor(now.getTime() / 1000));
    if (epMs) epMs.textContent = String(now.getTime());
  }

  function tickMsOnly() {
    const now = new Date();
    const epMs = $('epoch-live-ms');
    if (epMs) epMs.textContent = String(now.getTime());
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
    if (!btn) return;
    btn.addEventListener('click', () => {
      const raw = $('duration-input').value.trim();
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        $('duration-out').textContent = 'Invalid number.';
        return;
      }
      const parts = secondsToDurationParts(n);
      const sign = n < 0 ? '-' : '';
      $('duration-out').innerHTML =
        `<p><strong>${sign}${parts.years}</strong> y, ` +
        `<strong>${parts.months}</strong> mo, ` +
        `<strong>${parts.days}</strong> d, ` +
        `<strong>${parts.hours}</strong> h, ` +
        `<strong>${parts.minutes}</strong> min, ` +
        `<strong>${parts.seconds}</strong> s</p>` +
        `<p class="fine-print">${parts.note}</p>`;
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
      ['btn-copy-live-s', () => $('epoch-live-seconds').textContent],
      ['btn-copy-live-ms', () => $('epoch-live-ms').textContent],
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
