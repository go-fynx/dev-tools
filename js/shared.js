/**
 * Shared utilities for dev-tools
 */

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} - Success status
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Show a temporary toast/feedback
 * @param {HTMLElement} element - Button or element to show feedback on
 * @param {string} message - Message to show
 * @param {number} duration - Duration in ms
 */
function showCopyFeedback(element, message = 'Copied!', duration = 1500) {
  const originalText = element.textContent;
  element.textContent = message;
  element.disabled = true;
  setTimeout(() => {
    element.textContent = originalText;
    element.disabled = false;
  }, duration);
}

/**
 * Debounce function
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in ms
 * @returns {Function}
 */
function debounce(fn, ms) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Initialize theme from localStorage
 */
function initTheme() {
  const stored = localStorage.getItem('dev-tools-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

/**
 * Toggle theme and persist
 */
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dev-tools-theme', next);
  return next;
}
