# Palette Journal - Critical UX & Accessibility Learnings

## 2026-10-08 - Accessible Icon Buttons in Experiment Cards
**Learning:** Icon-only buttons without `aria-label` rely solely on visual icons or tooltip titles which screen readers may not pronounce consistently.
**Action:** Always provide explicit `aria-label` attributes alongside `title` attributes on all icon-only action buttons.

## 2026-10-18 - Accessible Modal Dialog Keyboard & ARIA Attributes
**Learning:** Custom overlay modals created using portals or styled divs lack default keyboard closing (Escape key) and proper screen reader semantics (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).
**Action:** Always add an `Escape` key listener with cleanup in `useEffect` and attach standard dialog ARIA attributes when creating modal components.

## 2026-10-28 - Dropdown Actions with Hash Links vs Semantic Buttons
**Learning:** Using `<a href="#">` for dropdown menu triggers or items causes unexpected page scrolling / URL hash changes when clicked in single-page applications.
**Action:** Always use `<button type="button">` for dropdown items that trigger JavaScript functions rather than navigating to a page, and include proper ARIA state attributes (`aria-expanded`, `aria-haspopup`).
