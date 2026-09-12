# StoreStock design specification

Version 2 · September 2026

## Design thesis

StoreStock is a calm, high-contrast counter workspace: confident typography, compact information density, green action emphasis, and motion used to confirm state. The public landing page shares the same trust but has more editorial breathing room. The product UI puts the operator's next action first.

## Visual system

- Geist Sans with Inter/Arial fallback; body and controls start at 16px or larger.
- Light: cool near-white shell, white panels, charcoal text, deep green primary action.
- Dark: blue-black shell, slate panels, pale text, accessible borders.
- Accents: green, blue, orange, purple. Accent changes action/focus colors, not warning/error meaning.
- 12–16px panel corners, 1px borders, restrained shadows, minimum 44px touch targets.
- Status uses text plus color. Motion is short and respects prefers-reduced-motion.

## Information architecture

Public landing: navigation → value proposition → feature proof → workspace preview → daily workflow → secure access → footer.

Owner: header → shop controls → shop switcher → owner summary → shop workspace.

Shop: header → horizontal mobile navigation → Sell, Products, Bills, Customers, Suppliers, Purchases, Cash & expenses, Reports, Recurring bills, Shop settings.

## Responsive rules

- The shell never creates horizontal overflow.
- Dense tables scroll inside their own container; text is not shrunk below readable sizes.
- Navigation becomes a sticky horizontal strip below 850px.
- Checkout, forms, KPIs, and settings stack below 620px; product cards remain two columns for quick counter tapping.
- Test 320px, 375px, 430px, 768px, 1024px, and desktop widths.
- Respect 200% browser text enlargement; content may grow vertically.

## Accessibility and states

Every input has a visible label and accessible name. Focus rings remain visible in both themes. Busy, offline, queued, rejected, and saved states use text with role=status. Destructive actions are confirmable or recoverable. Voice controls expose privacy help and stop on unmount. Receipts distinguish final invoices from pending offline requests.

## Public landing rules

Describe only implemented workflows and label illustrative data as example data. Do not mention component libraries, design inspirations, or internal implementation names. Use customer language: inventory, bills, cash, credit, suppliers, shops, and closing. Keep vendor comparisons in internal documentation.
