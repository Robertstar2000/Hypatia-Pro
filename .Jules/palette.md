# Palette Journal - Critical UX & Accessibility Learnings

## 2026-10-08 - Accessible Icon Buttons in Experiment Cards
**Learning:** Icon-only buttons without `aria-label` rely solely on visual icons or tooltip titles which screen readers may not pronounce consistently.
**Action:** Always provide explicit `aria-label` attributes alongside `title` attributes on all icon-only action buttons.

## 2026-10-12 - Mandatory ARIA Labels on Bootstrap Close Buttons
**Learning:** Bootstrap `.btn-close` elements are rendered as empty `<button>` elements with background images and lack accessible text names for assistive technology.
**Action:** Always add an explicit `aria-label` attribute (e.g. `aria-label="Close menu"`) to all `.btn-close` buttons.
