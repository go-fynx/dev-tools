/**
 * Binds DOM for crons-utilities/index.html — uses cronUtils from cron-utils.js
 */
(function () {
  'use strict';

  function $(id) {
    return document.getElementById(id);
  }

  function initTabs() {
    const buttons = document.querySelectorAll('#crons-hub [data-tab-target]');
    const panels = document.querySelectorAll('#crons-hub [data-tab-panel]');
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
        localStorage.setItem('crons-utilities-active-tab', name);
      } catch (_) {}
    }
    buttons.forEach((b) => {
      b.addEventListener('click', () => activate(b.getAttribute('data-tab-target')));
    });
    const saved = localStorage.getItem('crons-utilities-active-tab') || 'builder';
    if (document.querySelector('#crons-hub [data-tab-target="' + saved + '"]')) activate(saved);
    else activate('builder');
  }

  function getScheduleType() {
    const el = $('cron-schedule-type');
    return el ? el.value : 'everyMinutes';
  }

  function setPanelsVisibility() {
    const t = getScheduleType();
    const map = {
      everyMinutes: 'cron-panel-every-minutes',
      hourly: 'cron-panel-hourly',
      daily: 'cron-panel-daily',
      weekly: 'cron-panel-weekly',
      monthly: 'cron-panel-monthly',
    };
    Object.entries(map).forEach(([key, id]) => {
      const el = $(id);
      if (el) el.hidden = key !== t;
    });
  }

  function readWeeklyDays() {
    const out = [];
    for (let d = 0; d <= 6; d++) {
      const cb = $('cron-dow-' + d);
      if (cb && cb.checked) out.push(d);
    }
    return out;
  }

  function buildScheduleConfig() {
    const t = getScheduleType();
    switch (t) {
      case 'everyMinutes':
        return {
          type: 'everyMinutes',
          intervalMinutes: Number($('cron-interval-minutes').value),
        };
      case 'hourly':
        return {
          type: 'hourly',
          minute: Number($('cron-hourly-minute').value),
          hourInterval: Number($('cron-hour-interval').value),
        };
      case 'daily':
        return {
          type: 'daily',
          hour: Number($('cron-daily-hour').value),
          minute: Number($('cron-daily-minute').value),
        };
      case 'weekly': {
        const days = readWeeklyDays();
        return {
          type: 'weekly',
          day: days,
          hour: Number($('cron-weekly-hour').value),
          minute: Number($('cron-weekly-minute').value),
        };
      }
      case 'monthly':
        return {
          type: 'monthly',
          dayOfMonth: Number($('cron-monthly-dom').value),
          hour: Number($('cron-monthly-hour').value),
          minute: Number($('cron-monthly-minute').value),
        };
      default:
        return { type: 'everyMinutes', intervalMinutes: 5 };
    }
  }

  function validateBuilderInputs() {
    const t = getScheduleType();
    const err = $('cron-builder-validation');
    if (!err) return '';

    if (t === 'everyMinutes') {
      const n = Number($('cron-interval-minutes').value);
      if (!Number.isFinite(n) || n < 1 || n > 59) {
        err.textContent = 'Interval must be between 1 and 59.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
    }
    if (t === 'hourly') {
      const m = Number($('cron-hourly-minute').value);
      const hi = Number($('cron-hour-interval').value);
      if (!Number.isFinite(m) || m < 0 || m > 59) {
        err.textContent = 'Minute must be between 0 and 59.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
      if (!Number.isFinite(hi) || hi < 1 || hi > 23) {
        err.textContent = 'Hour interval must be between 1 and 23.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
    }
    if (t === 'daily') {
      const h = Number($('cron-daily-hour').value);
      const m = Number($('cron-daily-minute').value);
      if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
        err.textContent = 'Hour must be 0–23 and minute 0–59.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
    }
    if (t === 'weekly') {
      const days = readWeeklyDays();
      if (days.length === 0) {
        err.textContent = 'Select at least one day of week.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
      const h = Number($('cron-weekly-hour').value);
      const m = Number($('cron-weekly-minute').value);
      if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
        err.textContent = 'Hour must be 0–23 and minute 0–59.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
    }
    if (t === 'monthly') {
      const dom = Number($('cron-monthly-dom').value);
      const h = Number($('cron-monthly-hour').value);
      const m = Number($('cron-monthly-minute').value);
      if (!Number.isFinite(dom) || dom < 1 || dom > 31) {
        err.textContent = 'Day of month must be between 1 and 31.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
      if (!Number.isFinite(h) || h < 0 || h > 23 || !Number.isFinite(m) || m < 0 || m > 59) {
        err.textContent = 'Hour must be 0–23 and minute 0–59.';
        err.className = 'validation-msg error';
        return err.textContent;
      }
    }

    err.textContent = '';
    err.className = 'validation-msg';
    return '';
  }

  function refreshBuilder() {
    const errEl = $('cron-builder-validation');
    const exprEl = $('cron-out-expr');
    const humanEl = $('cron-out-human');
    if (!window.cronUtils || !exprEl || !humanEl) return;

    validateBuilderInputs();
    const hasErr = errEl && errEl.classList.contains('error');
    if (hasErr) {
      exprEl.value = '';
      humanEl.value = '';
      return;
    }

    const cfg = buildScheduleConfig();
    const cron = window.cronUtils.generateCron(cfg);
    if (!cron) {
      if (errEl) {
        errEl.textContent = 'Could not build a valid cron from these values.';
        errEl.className = 'validation-msg error';
      }
      exprEl.value = '';
      humanEl.value = '';
      return;
    }
    exprEl.value = cron;
    humanEl.value = window.cronUtils.cronToHuman(cron);
  }

  function bindBuilder() {
    const typeSel = $('cron-schedule-type');
    if (typeSel) {
      typeSel.addEventListener('change', () => {
        setPanelsVisibility();
        refreshBuilder();
      });
    }

    const ids = [
      'cron-interval-minutes',
      'cron-hourly-minute',
      'cron-hour-interval',
      'cron-daily-hour',
      'cron-daily-minute',
      'cron-weekly-hour',
      'cron-weekly-minute',
      'cron-monthly-dom',
      'cron-monthly-hour',
      'cron-monthly-minute',
    ];
    ids.forEach((id) => {
      const el = $(id);
      if (el) el.addEventListener('input', refreshBuilder);
    });
    for (let d = 0; d <= 6; d++) {
      const cb = $('cron-dow-' + d);
      if (cb) cb.addEventListener('change', refreshBuilder);
    }

    const btnW = $('btn-cron-weekdays');
    if (btnW) {
      btnW.addEventListener('click', () => {
        for (let d = 0; d <= 6; d++) {
          const cb = $('cron-dow-' + d);
          if (cb) cb.checked = d >= 1 && d <= 5;
        }
        refreshBuilder();
      });
    }
    const btnClear = $('btn-cron-clear-dow');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        for (let d = 0; d <= 6; d++) {
          const cb = $('cron-dow-' + d);
          if (cb) cb.checked = false;
        }
        refreshBuilder();
      });
    }

    $('btn-copy-cron-expr') &&
      $('btn-copy-cron-expr').addEventListener('click', async () => {
        const t = $('cron-out-expr').value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-copy-cron-expr'), ok ? 'Copied!' : 'Failed', 1500);
      });

    setPanelsVisibility();
    refreshBuilder();
  }

  function bindParser() {
    const input = $('cron-parse-input');
    const human = $('cron-parse-human');
    const val = $('cron-parse-validation');
    if (!input || !human || !window.cronUtils) return;

    function run() {
      const raw = input.value.trim();
      if (!raw) {
        human.value = '';
        if (val) {
          val.textContent = '';
          val.className = 'validation-msg';
        }
        return;
      }
      const out = window.cronUtils.cronToHuman(raw);
      human.value = out.startsWith('Invalid cron') ? '' : out;
      if (val) {
        if (out.startsWith('Invalid cron')) {
          val.textContent = out;
          val.className = 'validation-msg error';
        } else {
          val.textContent = '';
          val.className = 'validation-msg';
        }
      }
    }

    input.addEventListener('input', debounce(run, 150));
    input.addEventListener('change', run);
    run();

    $('btn-copy-cron-human') &&
      $('btn-copy-cron-human').addEventListener('click', async () => {
        const t = human.value;
        if (!t) return;
        const ok = await copyToClipboard(t);
        showCopyFeedback($('btn-copy-cron-human'), ok ? 'Copied!' : 'Failed', 1500);
      });
  }

  function init() {
    initTabs();
    bindBuilder();
    bindParser();
  }

  if (document.getElementById('crons-hub')) {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
