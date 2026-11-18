/**
 * v0.6 Pass 057: Tab and Shift+Tab cycle within an open panel (Settings, Seen) rather than
 * wandering into the page behind it; Escape closes it.
 */
export function keepFocusIn(panel: HTMLElement, event: KeyboardEvent): void {
  if (event.key !== 'Tab') return;
  const items = [
    ...panel.querySelectorAll<HTMLElement>(
      'button, input, select, a[href], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((e) => !e.hidden && e.offsetParent !== null);
  if (!items.length) return;
  const first = items[0],
    last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
