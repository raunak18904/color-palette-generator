/* =========================================
   DOM ELEMENTS
   Cache all required elements once to avoid
   repeated, expensive DOM queries later.
========================================= */
const generateBtn = document.getElementById('generateBtn');
const paletteSection = document.querySelector('.palette-section');
const colorCards = document.querySelectorAll('.color-card');

/* =========================================
   STATE
   Centralized, in-memory application state.
   Kept isolated (not global scattered vars)
   so future features (undo/redo, save, lock)
   can read/write a single source of truth.
========================================= */
const appState = {
  currentPalette: [],   // Array of 5 HEX strings currently displayed
  lockedIndexes: new Set(), // Reserved for future "lock color" feature
};

const PALETTE_SIZE = 5;
const HEX_DIGITS = '0123456789ABCDEF';
const COPY_NOTIFICATION_DURATION = 1000; // ms

/* =========================================
   UTILITY FUNCTIONS
========================================= */

/**
 * Generates a single random, valid 6-digit uppercase HEX color.
 * Why: centralizes color generation logic so it can be swapped
 * later (e.g. for AI-generated or constrained palettes) without
 * touching rendering code.
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
 * Generates an array of unique-ish random HEX colors.
 * @param {number} count - number of colors to generate
 * @returns {string[]} array of HEX color strings
 */
const generateRandomPalette = (count = PALETTE_SIZE) => {
  const palette = [];
  for (let i = 0; i < count; i += 1) {
    palette.push(generateRandomHexColor());
  }
  return palette;
};

/**
 * Validates that a string is a proper 6-digit HEX color.
 * Why: defensive check before writing to the DOM or clipboard,
 * guards against future bugs (e.g. AI-generated colors, imports).
 * @param {string} hex
 * @returns {boolean}
 */
const isValidHexColor = (hex) => /^#[0-9A-F]{6}$/.test(hex);

/* =========================================
   RENDERING
========================================= */

/**
 * Synchronizes the UI (previews + hex labels) with a palette array.
 * Why: single reusable render function keeps DOM updates consistent
 * and avoids duplicated update logic scattered across event handlers.
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

    if (!preview || !hexLabel) {
      console.error(`renderPalette: Missing preview or hex label in card index ${index}.`);
      return;
    }

    preview.style.backgroundColor = color;
    hexLabel.textContent = color;
  });

  appState.currentPalette = [...colors];
};

/**
 * Generates a brand new random palette and renders it.
 * Why: wraps generation + render + state update into one
 * reusable action triggered by button click or init.
 */
const generateAndRenderPalette = () => {
  try {
    const newPalette = generateRandomPalette(PALETTE_SIZE);
    renderPalette(newPalette);
  } catch (error) {
    console.error('generateAndRenderPalette: Failed to generate palette.', error);
  }
};

/* =========================================
   CLIPBOARD
========================================= */

/**
 * Displays a temporary "Copied!" notification near a given card.
 * Why: reusable feedback mechanism, avoids alert() and keeps
 * UI feedback consistent for future actions (e.g. "Locked!", "Saved!").
 * @param {HTMLElement} card - the color card element to attach the notice to
 */
const showCopyNotification = (card) => {
  if (!card) return;

  const notification = document.createElement('span');
  notification.className = 'copy-notification';
  notification.textContent = 'Copied!';
  notification.setAttribute('role', 'status');

  card.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, COPY_NOTIFICATION_DURATION);
};

/**
 * Copies a HEX value to the clipboard using the async Clipboard API.
 * Falls back gracefully (logs error) if the API is unavailable
 * or the operation fails, without crashing the app.
 * @param {string} hexValue
 * @param {HTMLElement} card - card element used for showing feedback
 */
const copyHexToClipboard = async (hexValue, card) => {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    console.error('copyHexToClipboard: Clipboard API not available in this browser.');
    return;
  }

  try {
    await navigator.clipboard.writeText(hexValue);
    showCopyNotification(card);
  } catch (error) {
    console.error('copyHexToClipboard: Failed to copy text.', error);
  }
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
 * Why: a single listener on the parent avoids attaching 5+ listeners
 * individually and automatically supports future dynamically added cards.
 * @param {MouseEvent} event
 */
const handlePaletteClick = (event) => {
  const hexLabel = event.target.closest('[data-hex]');
  if (!hexLabel) return;

  const card = event.target.closest('.color-card');
  const hexValue = hexLabel.textContent.trim();

  if (!isValidHexColor(hexValue)) {
    console.error('handlePaletteClick: Invalid hex value in DOM, skipping copy.');
    return;
  }

  copyHexToClipboard(hexValue, card);
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
};

/* =========================================
   INITIALIZATION
========================================= */

/**
 * Bootstraps the application: attaches listeners and ensures
 * the page never renders empty by generating an initial palette.
 */
const initApp = () => {
  try {
    attachEventListeners();
    generateAndRenderPalette();
  } catch (error) {
    console.error('initApp: Unexpected error during initialization.', error);
  }
};

document.addEventListener('DOMContentLoaded', initApp);