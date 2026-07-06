/* =========================================
   DOM REFERENCES
   Cache all required elements once to avoid
   repeated, expensive DOM queries later.
========================================= */
const generateBtn = document.getElementById('generateBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const paletteSection = document.querySelector('.palette-section');
const toastContainer = document.getElementById('toastContainer');
const colorCards = document.querySelectorAll('.color-card');
const htmlElement = document.documentElement;

/* =========================================
   CONSTANTS
========================================= */
const PALETTE_SIZE = 5;
const HEX_DIGITS = '0123456789ABCDEF';
const TOAST_DURATION_MS = 1000;
const THEME_STORAGE_KEY = 'colorPaletteGenerator:theme';
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';

/* =========================================
   APPLICATION STATE
   Centralized, in-memory state. Kept as a
   single source of truth so future features
   (favorites, history, undo/redo) can read
   and write it consistently.
========================================= */
const appState = {
  currentPalette: [],        // Array of 5 HEX strings currently displayed
  lockedIndexes: new Set(),  // Indexes whose color must survive regeneration
  theme: THEME_LIGHT,        // Active theme, kept in sync with the DOM + storage
};

/* =========================================
   UTILITY FUNCTIONS
========================================= */

/**
 * Generates a single random, valid 6-digit uppercase HEX color.
 * Purpose: centralizes color generation so it can be swapped later
 * (e.g. AI-generated or palette-constrained colors) without touching
 * rendering or state code.
 * @returns {string} HEX color in the format "#A1B2C3"
 */
const generateRandomHexColor = () => {
  let hex = '#';
  for (let i = 0; i < 6; i += 1) {
    const randomIndex = Math.floor(Math.random() * HEX_DIGITS.length);
    hex += HEX_DIGITS[randomIndex];
  }
  return hex;
};

/**
 * Validates that a string is a proper 6-digit uppercase HEX color.
 * @param {string} hex
 * @returns {boolean}
 */
const isValidHexColor = (hex) => /^#[0-9A-F]{6}$/.test(hex);

/**
 * Builds a new palette, preserving any locked colors from the
 * previous palette and generating fresh random colors for the rest.
 * Purpose: keeps the "lock" feature isolated from generation logic —
 * generation never needs to know *why* a color is preserved.
 * @param {string[]} previousPalette - the palette currently on screen
 * @param {Set<number>} lockedIndexes - indexes that must not change
 * @param {number} size - total number of colors in the palette
 * @returns {string[]} the new palette
 */
const buildNextPalette = (previousPalette, lockedIndexes, size = PALETTE_SIZE) => {
  const nextPalette = [];
  for (let index = 0; index < size; index += 1) {
    if (lockedIndexes.has(index) && previousPalette[index]) {
      nextPalette.push(previousPalette[index]);
    } else {
      nextPalette.push(generateRandomHexColor());
    }
  }
  return nextPalette;
};

/* =========================================
   RENDERING
========================================= */

/**
 * Synchronizes the UI (previews, hex labels, lock buttons) with a
 * palette array and the current locked state.
 * Purpose: single reusable render function keeps DOM updates
 * consistent and prevents duplicated update logic across handlers.
 * @param {string[]} colors - array of valid HEX color strings
 */
const renderPalette = (colors) => {
  if (!colorCards || colorCards.length === 0) {
    console.error('renderPalette: No color cards found in the DOM.');
    return;
  }

  colorCards.forEach((card, index) => {
    const color = colors[index];

    if (!color || !isValidHexColor(color)) {
      console.error(`renderPalette: Invalid or missing color at index ${index}.`);
      return;
    }

    const preview = card.querySelector('[data-preview]');
    const hexLabel = card.querySelector('[data-hex]');
    const lockBtn = card.querySelector('[data-lock-btn]');

    if (!preview || !hexLabel || !lockBtn) {
      console.error(`renderPalette: Missing required elements in card index ${index}.`);
      return;
    }

    preview.style.backgroundColor = color;
    hexLabel.textContent = color;

    const isLocked = appState.lockedIndexes.has(index);
    syncLockVisualState(card, lockBtn, isLocked);
  });

  appState.currentPalette = [...colors];
};

/**
 * Generates the next palette (respecting locked colors) and renders it.
 * Purpose: wraps generation + render + state update into a single
 * reusable action triggered by the button click or initialization.
 */
const generateAndRenderPalette = () => {
  try {
    const nextPalette = buildNextPalette(appState.currentPalette, appState.lockedIndexes, PALETTE_SIZE);
    renderPalette(nextPalette);
  } catch (error) {
    console.error('generateAndRenderPalette: Failed to generate palette.', error);
  }
};

/* =========================================
   LOCK FEATURE
========================================= */

/**
 * Updates a card's visual/ARIA state to reflect whether it is locked.
 * Purpose: keeps lock icon/attribute updates in one place so render
 * and the click handler never drift out of sync with each other.
 * @param {HTMLElement} card
 * @param {HTMLElement} lockBtn
 * @param {boolean} isLocked
 */
const syncLockVisualState = (card, lockBtn, isLocked) => {
  const icon = lockBtn.querySelector('i');

  card.setAttribute('data-locked', String(isLocked));
  lockBtn.setAttribute('data-locked', String(isLocked));
  lockBtn.setAttribute('aria-pressed', String(isLocked));
  lockBtn.setAttribute('aria-label', isLocked ? 'Unlock this color' : 'Lock this color');

  if (icon) {
    icon.classList.toggle('fa-lock', isLocked);
    icon.classList.toggle('fa-lock-open', !isLocked);
  }
};

/**
 * Toggles the locked state for a given card index and updates its UI.
 * @param {number} index
 * @param {HTMLElement} card
 * @param {HTMLElement} lockBtn
 */
const toggleLockForCard = (index, card, lockBtn) => {
  if (Number.isNaN(index)) {
    console.error('toggleLockForCard: Invalid card index.');
    return;
  }

  const isCurrentlyLocked = appState.lockedIndexes.has(index);

  if (isCurrentlyLocked) {
    appState.lockedIndexes.delete(index);
  } else {
    appState.lockedIndexes.add(index);
  }

  syncLockVisualState(card, lockBtn, !isCurrentlyLocked);
};

/* =========================================
   TOAST NOTIFICATIONS
========================================= */

/**
 * Displays a temporary toast message in the global toast container.
 * Purpose: single reusable feedback mechanism (replaces alert()) that
 * future features (save, export, undo) can call without new markup.
 * @param {string} message - text to display
 * @param {number} duration - how long the toast stays visible, in ms
 */
const showToast = (message, duration = TOAST_DURATION_MS) => {
  if (!toastContainer) {
    console.error('showToast: Toast container not found in the DOM.');
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.setAttribute('role', 'status');

  toastContainer.appendChild(toast);

  // Force reflow so the transition reliably plays on the next frame.
  requestAnimationFrame(() => {
    toast.classList.add('toast--visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener(
      'transitionend',
      () => {
        toast.remove();
      },
      { once: true }
    );
  }, duration);
};

/* =========================================
   CLIPBOARD
========================================= */

/**
 * Copies a HEX value to the clipboard using the async Clipboard API.
 * Fails gracefully (logs error, no crash) if unavailable.
 * @param {string} hexValue
 */
const copyHexToClipboard = async (hexValue) => {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    console.error('copyHexToClipboard: Clipboard API not available in this browser.');
    showToast('Copy not supported');
    return;
  }

  try {
    await navigator.clipboard.writeText(hexValue);
    showToast(`Copied ${hexValue}`);
  } catch (error) {
    console.error('copyHexToClipboard: Failed to copy text.', error);
    showToast('Copy failed');
  }
};

/* =========================================
   DARK MODE
========================================= */

/**
 * Applies a given theme to the document and updates the toggle button.
 * @param {string} theme - THEME_LIGHT or THEME_DARK
 */
const applyTheme = (theme) => {
  const isDark = theme === THEME_DARK;

  if (isDark) {
    htmlElement.setAttribute('data-theme', THEME_DARK);
  } else {
    htmlElement.removeAttribute('data-theme');
  }

  if (themeToggleBtn) {
    const icon = themeToggleBtn.querySelector('i');
    themeToggleBtn.setAttribute('aria-pressed', String(isDark));
    themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');

    if (icon) {
      icon.classList.toggle('fa-moon', !isDark);
      icon.classList.toggle('fa-sun', isDark);
    }
  }

  appState.theme = theme;
};

/**
 * Toggles between light and dark theme and persists the choice.
 */
const toggleTheme = () => {
  const nextTheme = appState.theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
  applyTheme(nextTheme);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch (error) {
    console.error('toggleTheme: Failed to persist theme preference.', error);
  }
};

/**
 * Determines the initial theme: stored preference, then system
 * preference, falling back to light mode.
 * @returns {string} THEME_LIGHT or THEME_DARK
 */
const resolveInitialTheme = () => {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === THEME_DARK || storedTheme === THEME_LIGHT) {
      return storedTheme;
    }
  } catch (error) {
    console.error('resolveInitialTheme: Failed to read stored theme.', error);
  }

  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? THEME_DARK : THEME_LIGHT;
};

/* =========================================
   EVENT LISTENERS
========================================= */

/**
 * Handles click on the "Generate Palette" button.
 */
const handleGenerateClick = () => {
  generateAndRenderPalette();
};

/**
 * Handles clicks within the palette section using event delegation.
 * Distinguishes between a hex-value click (copy) and a lock-button
 * click (toggle lock) from a single listener, so future controls
 * added to a card (favorite, share) only need one more branch here.
 * @param {MouseEvent} event
 */
const handlePaletteClick = (event) => {
  const lockBtn = event.target.closest('[data-lock-btn]');
  if (lockBtn) {
    const card = lockBtn.closest('.color-card');
    const index = Number(card?.dataset.cardIndex);
    toggleLockForCard(index, card, lockBtn);
    return;
  }

  const hexLabel = event.target.closest('[data-hex]');
  if (hexLabel) {
    const hexValue = hexLabel.textContent.trim();

    if (!isValidHexColor(hexValue)) {
      console.error('handlePaletteClick: Invalid hex value in DOM, skipping copy.');
      return;
    }

    copyHexToClipboard(hexValue);
  }
};

/**
 * Handles click on the theme toggle button.
 */
const handleThemeToggleClick = () => {
  toggleTheme();
};

const attachEventListeners = () => {
  if (generateBtn) {
    generateBtn.addEventListener('click', handleGenerateClick);
  } else {
    console.error('attachEventListeners: Generate button not found.');
  }

  if (paletteSection) {
    paletteSection.addEventListener('click', handlePaletteClick);
  } else {
    console.error('attachEventListeners: Palette section not found.');
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', handleThemeToggleClick);
  } else {
    console.error('attachEventListeners: Theme toggle button not found.');
  }
};

/* =========================================
   INITIALIZATION
========================================= */

/**
 * Bootstraps the application: applies the initial theme, attaches
 * listeners, and ensures the page never renders empty by generating
 * an initial palette.
 */
const initApp = () => {
  try {
    applyTheme(resolveInitialTheme());
    attachEventListeners();
    generateAndRenderPalette();
  } catch (error) {
    console.error('initApp: Unexpected error during initialization.', error);
  }
};

document.addEventListener('DOMContentLoaded', initApp);