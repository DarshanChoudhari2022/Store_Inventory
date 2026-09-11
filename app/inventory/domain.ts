export type Item = {
  id: string; name: string; category: string; buyingPrice: number;
  defaultSellingPrice: number; stock: number; reorderLevel: number;
};
export type Sale = {
  id: string; itemId: string | null; itemName: string; qty: number;
  buyingPrice: number; soldPrice: number; date: string;
};
export type Dashboard = {
  shop: { id: string; name: string; area: string; username: string };
  items: Item[]; todaysSales: Sale[];
};
export type ItemDraft = Omit<Item, 'id'>;
export const money = (n: number) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(n);
export const indiaDate = (now = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);
export function stockStatus(item: Item) {
  return item.stock === 0 ? 'out' : item.stock <= item.reorderLevel ? 'low' : 'in';
}
export function totals(sales: Sale[]) {
  return sales.reduce((sum, sale) => ({
    qty: sum.qty + sale.qty,
    revenue: sum.revenue + Math.round(sale.qty * sale.soldPrice * 100) / 100,
    profit: sum.profit + Math.round(sale.qty * (sale.soldPrice - sale.buyingPrice) * 100) / 100,
  }), { qty: 0, revenue: 0, profit: 0 });
}
export function validateItem(item: ItemDraft) {
  if (!item.name.trim() || item.name.trim().length > 120 || !item.category.trim() || item.category.trim().length > 80) return false;
  if (![item.stock, item.reorderLevel].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2147483647)) return false;
  return [item.buyingPrice, item.defaultSellingPrice].every(n => Number.isFinite(n) && n >= 0 && n <= 9999999999.99 && Math.abs(n * 100 - Math.round(n * 100)) < 0.001);
}
export function closingCsv(data: Dashboard) {
  // Escape formula prefixes as well as CSV delimiters for spreadsheet imports.
  const cell = (value: string | number) => '"' + String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  const sum = totals(data.todaysSales);
  const rows: (string | number)[][] = [
    ['Shop', data.shop.name], ['Date (IST)', indiaDate()],
    ['Revenue', sum.revenue.toFixed(2)], ['Profit', sum.profit.toFixed(2)], ['Units sold', sum.qty],
    [], ['Item', 'Category', 'Available qty', 'Buy price', 'Sell price', 'Restock threshold'],
    ...data.items.map(i => [i.name, i.category, i.stock, i.buyingPrice, i.defaultSellingPrice, i.reorderLevel]),
    [], ['Sales'], ['Item', 'Qty', 'Sold price', 'Buy price', 'Revenue', 'Profit'],
    ...data.todaysSales.map(s => [s.itemName, s.qty, s.soldPrice, s.buyingPrice, (s.qty*s.soldPrice).toFixed(2), (s.qty*(s.soldPrice-s.buyingPrice)).toFixed(2)]),
  ];
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
