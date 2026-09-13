type BluetoothUuid = string | number;
type BluetoothCharacteristic = { writeValue: (value: BufferSource) => Promise<void> };
type BluetoothService = { getCharacteristic: (characteristic: BluetoothUuid) => Promise<BluetoothCharacteristic> };
type BluetoothServer = { connect: () => Promise<{ getPrimaryService: (service: BluetoothUuid) => Promise<BluetoothService> }> };
type BluetoothDevice = { gatt?: BluetoothServer };
type BluetoothApi = {
  requestDevice: (options: { acceptAllDevices: boolean; optionalServices: BluetoothUuid[] }) => Promise<BluetoothDevice>;
};

declare global {
  interface Navigator {
    bluetooth?: BluetoothApi;
  }
}

const encoder = new TextEncoder();
const lineWidth = (paper?: string) => paper === "58" ? 32 : 42;
const serviceCandidates: BluetoothUuid[] = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
];
const characteristicCandidates: BluetoothUuid[] = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ff01-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
];

const clean = (value: unknown) => String(value ?? "").replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim();
const cash = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const productName = (p: ThermalProduct) => [p.name,p.style_code,p.size,p.colour].filter(Boolean).join(" · ");
const center = (text: string, width: number) => {
  const value = clean(text).slice(0, width);
  const pad = Math.max(0, Math.floor((width - value.length) / 2));
  return " ".repeat(pad) + value;
};
const money = (value: number) => cash(value).replace("₹", "Rs ");
const rule = (width: number) => "-".repeat(width);
const wrap = (text: string, width: number) => {
  const words = clean(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word.slice(0, width);
    else if ((current + " " + word).length <= width) current += " " + word;
    else { lines.push(current); current = word.slice(0, width); }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
};
const columns = (left: string, right: string, width: number) => {
  const r = clean(right).slice(0, Math.min(14, width));
  const room = Math.max(1, width - r.length - 1);
  return wrap(left, room).map((line, index) => index === 0 ? line.padEnd(width - r.length) + r : line);
};

export type ThermalInvoice = {
  number: string;
  customer: {name?: string; gstin?: string; address?: string};
  shop_snapshot: {name: string; area: string; settings: {paper?: string; gstin?: string; address?: string; phone?: string; upi?: string; receiptNote?: string}};
  lines: {name:string;qty:number;price:number;discount:number;unit:string;hsn:string;rate:number;net:number;tax:number;total:number;cost:number}[];
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  method: string;
  tenders?: Partial<Record<"cash"|"upi"|"card",number>>;
  interstate: boolean;
  supply_state: string;
  created_at: string;
};
export type ThermalProduct = {name:string;default_selling_price:number;unit:string;barcode:string;hsn?:string;mrp?:number|null;style_code?:string;size?:string;colour?:string};

export function receiptText(invoice: ThermalInvoice) {
  const width = lineWidth(invoice.shop_snapshot.settings.paper);
  const s = invoice.shop_snapshot.settings;
  const rows = [
    center(invoice.shop_snapshot.name, width),
    center(s.gstin ? "Tax invoice" : "Sales receipt", width),
    clean(s.address || invoice.shop_snapshot.area),
    clean(s.phone),
    s.gstin ? `GSTIN: ${clean(s.gstin)}` : "",
    rule(width),
    `Bill ${clean(invoice.number)}`,
    new Date(invoice.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST",
    `Customer: ${clean(invoice.customer.name || "Walk-in")}`,
    invoice.customer.gstin ? `Customer GSTIN: ${clean(invoice.customer.gstin)}` : "",
    invoice.supply_state ? `Place: ${clean(invoice.supply_state)}` : "",
    rule(width),
    ...invoice.lines.flatMap(line => [
      ...wrap(line.name, width),
      ...columns(`${line.qty} ${line.unit} x ${money(line.price)}`, money(line.total), width),
      line.hsn || line.rate > 0 ? clean(`${line.hsn ? "HSN " + line.hsn : ""} ${line.rate > 0 ? "GST " + line.rate + "%" : ""}`) : "",
    ]),
    rule(width),
    ...columns("Taxable value", money(invoice.subtotal), width),
    ...(invoice.tax > 0 ? invoice.interstate
      ? columns("IGST", money(invoice.tax), width)
      : [...columns("CGST", money(Math.floor(invoice.tax * 50) / 100), width), ...columns("SGST/UTGST", money(invoice.tax - Math.floor(invoice.tax * 50) / 100), width)]
      : []),
    ...columns("Total", money(invoice.total), width),
    ...columns(`Paid (${invoice.method})`, money(invoice.paid), width),
    ...(invoice.method === "split" ? Object.entries(invoice.tenders || {}).filter(([, amount]) => Number(amount) > 0).flatMap(([method, amount]) => columns(method.toUpperCase(), money(Number(amount)), width)) : []),
    ...columns("Due at issue", money(invoice.total - invoice.paid), width),
    s.upi ? `UPI: ${clean(s.upi)}` : "",
    rule(width),
    clean(s.receiptNote || "Thank you for shopping with us"),
    "",
    "Authorized signatory:",
    "",
  ].filter(Boolean);
  return rows.join("\n");
}

export function labelText(product: ThermalProduct, width = 32) {
  return [
    center(productName(product), width),
    center(`${money(product.default_selling_price)} / ${clean(product.unit)}`, width),
    product.mrp != null ? center(`MRP ${money(product.mrp)}`, width) : "",
    product.hsn ? center(`HSN ${clean(product.hsn)}`, width) : "",
    product.barcode ? center(`Barcode ${clean(product.barcode)}`, width) : "",
    "",
  ].filter(Boolean).join("\n");
}

export function escposPayload(text: string) {
  const prefix = [0x1b, 0x40, 0x1b, 0x61, 0x00];
  const suffix = [0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x42, 0x00];
  return new Uint8Array([...prefix, ...encoder.encode(text), ...suffix]);
}

async function writeChunks(characteristic: BluetoothCharacteristic, payload: Uint8Array) {
  for (let offset = 0; offset < payload.length; offset += 180) {
    await characteristic.writeValue(payload.slice(offset, offset + 180));
  }
}

export async function printEscPosBluetooth(text: string) {
  if (!navigator.bluetooth) throw new Error("Web Bluetooth printing is unavailable in this browser. Use Chrome/Edge on Android or desktop, or use Print / PDF.");
  const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: serviceCandidates });
  if (!device.gatt) throw new Error("This printer did not expose a Bluetooth GATT service.");
  const server = await device.gatt.connect();
  let lastError: unknown;
  for (const serviceId of serviceCandidates) {
    try {
      const service = await server.getPrimaryService(serviceId);
      for (const characteristicId of characteristicCandidates) {
        try {
          const characteristic = await service.getCharacteristic(characteristicId);
          await writeChunks(characteristic, escposPayload(text));
          return;
        } catch (error) { lastError = error; }
      }
    } catch (error) { lastError = error; }
  }
  throw new Error(lastError instanceof Error ? `Printer service not supported: ${lastError.message}` : "Printer service not supported.");
}
