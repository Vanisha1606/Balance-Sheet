/** Devanagari script block used by Hindi keyboard */
const DEVANAGARI = /[\u0900-\u097F]/g;

export function containsDevanagari(value: string): boolean {
  return DEVANAGARI.test(value);
}

/** Convert Hindi/Devanagari and Eastern-Arabic numerals to Western digits 0-9 */
export function toWesternDigits(value: string): string {
  const easternArabic = '٠١٢٣٤٥٦٧٨٩';
  const devanagari = '०१२३४५६७८९';
  return value
    .replace(/[٠-٩]/g, (ch) => String(easternArabic.indexOf(ch)))
    .replace(/[०-९]/g, (ch) => String(devanagari.indexOf(ch)));
}

/** Strip Hindi letters and normalize digits — for all text fields */
export function toLatinInput(value: string): string {
  return toWesternDigits(value).replace(DEVANAGARI, '');
}

/** Keep only Western digits and a single decimal point for numeric cells */
export function filterWesternNumeric(value: string): string {
  return toLatinInput(value).replace(/[^0-9.\-]/g, '');
}

/** Sanitize spreadsheet cell input — strips Hindi and normalizes digits */
export function sanitizeCellInput(value: string, numeric: boolean): string {
  const latin = toLatinInput(value);
  return numeric ? filterWesternNumeric(latin) : latin;
}

export function applyEnglishInputAttributes(element: HTMLElement): void {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    return;
  }

  if (element.dataset.englishInputPatched === 'true') {
    return;
  }
  element.dataset.englishInputPatched = 'true';

  element.lang = 'en-US';
  element.setAttribute('autocorrect', 'off');
  element.setAttribute('autocomplete', 'off');
  element.setAttribute('spellcheck', 'false');
  element.setAttribute('autocapitalize', 'off');
  element.setAttribute('enterkeyhint', 'done');

  if (element instanceof HTMLInputElement) {
    if (element.type !== 'tel' && element.type !== 'number') {
      element.type = 'text';
    }
    if (!element.inputMode || element.inputMode === 'decimal') {
      element.inputMode = element.type === 'tel' ? 'numeric' : 'text';
    }
  }
}

export function setupEnglishKeyboard(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  document.documentElement.lang = 'en-US';
  if (document.body) {
    document.body.lang = 'en-US';
  }

  const patchTree = (root: ParentNode = document) => {
    root.querySelectorAll('input, textarea').forEach((node) => {
      applyEnglishInputAttributes(node as HTMLElement);
    });
  };

  patchTree();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLElement) {
          if (node.matches('input, textarea')) {
            applyEnglishInputAttributes(node);
          }
          patchTree(node);
        }
      });
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
