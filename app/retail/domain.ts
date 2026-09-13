export type Product = {
  id: string;
  name: string;
  category: string;
  buying_price: number;
  default_selling_price: number;
  stock: number;
  reorder_level: number;
  barcode: string;
  unit: string;
  hsn: string;
  tax_rate: number;
  expiry_date: string | null;
  style_code?: string;
  size?: string;
  colour?: string;
  mrp?: number | null;
  is_active?: boolean;
};
export const productName = (p: Product) => [p.name,p.style_code,p.size,p.colour].filter(Boolean).join(' · ');
export type Contact = {
  credit_limit?:number|null;
  payment_terms_days?:number;
  id: string;
  kind: "customer" | "supplier";
  name: string;
  phone: string;
  address: string;
  gstin: string;
  balance: number;
};
export type CartLine = {
  id: string;
  qty: number;
  price: number;
  discount: number;
};
export type InvoiceLine = CartLine & {
  name: string;
  unit: string;
  hsn: string;
  rate: number;
  net: number;
  tax: number;
  total: number;
  cost: number;
};
export type Settings = {
  gstin?: string;
  address?: string;
  state?: string;
  phone?: string;
  upi?: string;
  receiptNote?: string;
  paper?: string;
};
export type Invoice = {
  due_date?:string|null;
  id: string;
  number: string;
  customer_id: string | null;
  customer: Partial<Contact>;
  shop_snapshot: { name: string; area: string; settings: Settings };
  lines: InvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
  cost: number;
  paid: number;
  method: string;
  interstate: boolean;
  supply_state: string;
  created_at: string;
};
export type Purchase = {
  id: string;
  supplier_id: string;
  reference: string;
  lines: InvoiceLine[];
  total: number;
  paid: number;
  method: string;
  created_at: string;
};
export type Workspace = {
  pageOffset?:number;
  pageView?:string;
  pageTotals?:Record<string,number>;
  summary?: ReturnType<typeof report> & {asOf:string};
  shop: {
    id: string;
    name: string;
    area: string;
    active: boolean;
    settings: Settings;
  };
  products: Product[];
  contacts: Contact[];
  invoices: Invoice[];
  purchases: Purchase[];
  payments: {
    id: string;
    contact_id: string;
    amount: number;
    method: string;
    created_at: string;
  }[];
  expenses: {
    id: string;
    description: string;
    amount: number;
    method: string;
    created_at: string;
  }[];
  returns: {
    id: string;
    invoice_id: string;
    refund: number;
    total: number;
    subtotal: number;
    tax: number;
    cost: number;
    number: string;
    created_at: string;
  }[];
  returnedIds: string[];
  registers: {
    id: string;
    opening: number;
    opened_at: string;
    closed_at: string | null;
    currentExpected: number;
    expected: number;
    counted: number;
    note: string;
  }[];
  movements: {
    id: string;
    item_name: string;
    quantity: number;
    reason: string;
    created_at: string;
  }[];
  recurring: {
    id: string;
    customer_id: string;
    name: string;
    cadence: string;
    next_date: string;
    active: boolean;
    lines: CartLine[];
    automatic?: boolean;
    route?: string;
    skip_dates?: string[];
    last_attempt_at?: string;
    last_error?: string;
  }[];
  legacy: {
    qty: number;
    sold_price: number;
    buying_price: number;
    sale_date: string;
  }[];
};
export const cash = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const lineTotal = (l: CartLine) =>
  round(l.qty * l.price * (1 - l.discount / 100));
export function report(w: Workspace) {
  const sum = <T>(rows: T[], f: (r: T) => number) =>
    round(rows.reduce((n, r) => n + f(r), 0));
  const sales =
    sum(w.invoices, (i) => Number(i.total)) -
    sum(w.returns, (r) => Number(r.total)) +
    sum(w.legacy, (l) => l.qty * l.sold_price);
  const tax =
    sum(w.invoices, (i) => Number(i.tax)) -
    sum(w.returns, (r) => Number(r.tax));
  const gross =
    sum(w.invoices, (i) => Number(i.subtotal) - Number(i.cost)) -
    sum(w.returns, (r) => Number(r.subtotal) - Number(r.cost)) +
    sum(w.legacy, (l) => l.qty * (l.sold_price - l.buying_price));
  const expenses = sum(w.expenses, (e) => Number(e.amount));
  return {
    sales: round(sales),
    tax: round(tax),
    gross: round(gross),
    expenses,
    net: round(gross - expenses),
    receivable: sum(
      w.contacts.filter((c) => c.kind === "customer"),
      (c) => Number(c.balance),
    ),
    payable: sum(
      w.contacts.filter((c) => c.kind === "supplier"),
      (c) => Number(c.balance),
    ),
  };
}
export function csvText(rows: (string | number)[][]) {
  return (
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map(
            (x) =>
              '"' +
              String(x)
                .replace(/^[=+@\-\t\r]/, "'$&")
                .replaceAll('"', '""') +
              '"',
          )
          .join(","),
      )
      .join("\r\n")
  );
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(
    new Blob([csvText(rows)], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed quote in CSV");
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
