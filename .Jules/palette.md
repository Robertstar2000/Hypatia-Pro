# Palette Journal - Critical UX & Accessibility Learnings

## 2026-10-08 - Accessible Icon Buttons in Experiment Cards
**Learning:** Icon-only buttons without `aria-label` rely solely on visual icons or tooltip titles which screen readers may not pronounce consistently.
**Action:** Always provide explicit `aria-label` attributes alongside `title` attributes on all icon-only action buttons.
