# Start using StoreStock

## Owner: set up each shop

1. Sign in, open **Manage / add shops**, and create the shop.
2. Give its generated login to the person managing that shop. Each shop has separate products, stock and bills.
3. Switch to that shop and open **Shop settings**. Enter receipt details and, if applicable, its GST registration information.
4. Add products yourself or let the shop operator add them. A new shop starts empty.

## Owner: give staff their own logins

1. Select the shop and open **Staff access** below the shop selector.
2. Enter the operator's name and a unique username, then choose **Create operator login**.
3. Share the displayed password privately, then hide it. Operators have full access to their assigned shop; these are not restricted cashier accounts.
4. Use **Pause access** when someone leaves or should stop working. Password reset signs the operator out and displays a newly generated password. They cannot manage other staff or access another shop.

## Clothing shop: set up stock

1. Open **Products → Add product**. Enter the product name, buying price, selling price and quantity.
2. For clothing, fill **Style / SKU**, **Size**, **Colour**, and optional **MRP**. Use one product row and a distinct barcode for each size/colour combination.
3. Use **Add size / colour** to copy the style and prices into another variant. The new variant starts with zero stock and no barcode; enter its actual quantity and barcode.
4. For bulk entry, download the CSV template, add your variants and import it. Review the rows before saving. The original non-clothing CSV format remains supported.

Example: Oxford shirt / OX-01 / M / Navy and Oxford shirt / OX-01 / L / Navy are two independent stock records.

## At the counter

1. Open **Sell** and search by product, style, size, colour or barcode.
2. Tap the correct variant, check quantity, choose cash/UPI/card/credit, and select a customer for credit.
3. For cash, enter the amount received and return the displayed change. Save the bill, then print or share its receipt.
4. During an outage, sales remain pending on this device until the server confirms them. Do not enter the same sale again.

## Manage products safely

- To stop selling an item, open **Edit / count** and clear **Available for sale**. Physical stock and old receipts remain intact. Turn it back on to resume sales.
- **Delete** requires your current login password, checked by the server. Five incorrect attempts lock deletion for fifteen minutes.
- Products on existing bills cannot be deleted because they may be returned later. Mark them inactive instead. Products on active recurring templates must first be removed from that workflow by pausing the template.
- Deletion retains an internal audit snapshot; the password is never stored in that snapshot or the offline queue.
- Owner sessions created before this update must sign out and sign back in once before password confirmation is available.

## Close the day

Review cash and other collections in **Cash & expenses**, enter expenses, reconcile the register and close it. Use **Reports** for the date-range summary. Receive new stock through **Purchases** and use physical counts only to correct actual differences.
