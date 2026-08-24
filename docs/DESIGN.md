# Design Document

## Product Shape

This is an operational dashboard, not a landing page. The first screen after login focuses on the numbers a shop admin needs while working: today's sales, profit, units sold, stock value, highest seller, inventory, sale entry, and low-stock analysis.

## Information Architecture

- Login
  - Admin identity fields.
  - Prototype note for local-only authentication.
- Dashboard
  - KPI strip.
  - Inventory table.
  - Record sale panel.
  - Add custom item panel.
  - Low-stock analysis.
  - Today's sales log.

## Visual Direction

The interface uses a practical small-business palette:

- Warm off-white background for long daily use.
- White panels for data surfaces.
- Deep green for primary actions and positive status.
- Muted orange for restock warnings.
- Dark neutral text for readability.

The design avoids oversized marketing sections after login. Data density is moderate so it works for both a small laptop and a mobile device.

## Interaction Design

### Record Sale

The sale form keeps the most common workflow compact:

1. Select product.
2. Enter quantity.
3. Enter sold price per piece.
4. Save sale.

The sold price is editable because tapri pricing can vary by customer, loose item, pack, or time.

### Closing Stock

Each inventory row has an editable closing count. The owner can physically count items at night and correct the stock directly without opening another page.

### Low Stock

Items at or below their reorder level are flagged in the table and repeated in a focused low-stock list.

## Responsive Behavior

- KPI cards wrap across screen sizes.
- Inventory table scrolls horizontally on smaller screens to preserve readable columns.
- Forms stack naturally on narrow viewports.
- Buttons and inputs use stable sizing for touch-friendly operation.

## Accessibility Notes

- Form fields use labels.
- Closing count inputs include item-specific aria labels.
- Status text is visible, not color-only.
- Color contrast is chosen for practical readability.

## Future Design Extensions

- Add a compact "counter mode" with large quick-sale buttons.
- Add Marathi/Hindi language toggle.
- Add a closing-day checklist.
- Add role-specific views for owner and helper.
- Add printable or WhatsApp-friendly reports.
