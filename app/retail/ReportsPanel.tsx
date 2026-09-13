"use client";
import { Download } from "lucide-react";
import { cash, downloadCsv, type Workspace } from "./domain";
import { useState } from "react";

type Props = { data: Workspace; summary: ReturnType<typeof import("./domain").report> & { asOf?: string }; from: string; to: string; offline: boolean; rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };
type ExportRecord = Record<string, string | number | null | undefined>;
type StatementRow = {account:string;debit:number;credit:number};
type AccountingExport = {
  generatedAt:string;
  gstr1: Record<string,string|number>[];
  hsnSummary: Record<string,string|number>[];
  gstr3b: Record<string,number>;
  trialBalance: StatementRow[];
  balanceSheet: {assets:Record<string,number>;liabilities:Record<string,number>;equity:Record<string,number>};
  cashFlow: {operating:Record<string,number>};
};

export default function ReportsPanel({ data, summary, from, to, offline, rpc }: Props) {
  const [exporting, setExporting] = useState(false);
  const [accountingExporting, setAccountingExporting] = useState(false);
  const accountingEnabled = data.flags?.accounting === true;
  const exportReport = async () => {
    setExporting(true);
    try {
      const invoices: ExportRecord[] = []; let returns: ExportRecord[] = []; let offset = 0;
      do {
        const page = await rpc("retail_report_export_page", { p_shop_id: data.shop.id, p_from: from, p_to: to, p_offset: offset, p_limit: 500 }) as { invoices?: ExportRecord[]; returns?: ExportRecord[]; hasMore?: boolean };
        invoices.push(...(page.invoices || [])); if (offset === 0) returns = page.returns || [];
        offset += 500; if (!page.hasMore) break;
      } while (invoices.length < 100_000);
      const rows = [["Shop", data.shop.name], ["From", from], ["To", to], ...Object.entries(summary).map(([key,value]) => [key,value] as (string|number)[]), [], ["Bill","Date","Net","Tax","Total","Cost","Paid","Method"], ...invoices.map(i => [i.number,i.created_at,i.subtotal,i.tax,i.total,i.cost,i.paid,i.method] as (string|number)[]), [], ["Returns","Date","Total","Tax","Refund"], ...returns.map(r => [r.number,r.created_at,r.total,r.tax,r.refund] as (string|number)[])];
      downloadCsv(`report-${from}-${to}.csv`, rows);
    } finally { setExporting(false); }
  };
  const loadAccounting = async () => rpc("retail_accounting_export", { p_shop_id: data.shop.id, p_from: from, p_to: to }) as Promise<AccountingExport>;
  const exportGstWorkpapers = async () => {
    setAccountingExporting(true);
    try {
      const result = await loadAccounting();
      downloadCsv(`gst-workpapers-${from}-${to}.csv`, [
        ["Shop", data.shop.name],
        ["From", from],
        ["To", to],
        ["Generated", result.generatedAt],
        [],
        ["GSTR-3B summary", "Amount"],
        ...Object.entries(result.gstr3b).map(([key,value]) => [key, value] as (string|number)[]),
        [],
        ["HSN", "Rate", "Taxable value", "CGST", "SGST", "IGST", "Total"],
        ...result.hsnSummary.map(row => [row.hsn, row.rate, row.taxableValue, row.cgst, row.sgst, row.igst, row.total] as (string|number)[]),
        [],
        ["Type", "Bill", "Date", "Customer GSTIN", "Place of supply", "Item", "HSN", "Rate", "Taxable value", "CGST", "SGST", "IGST", "Total"],
        ...result.gstr1.map(row => [row.type,row.bill,row.date,row.customerGstin,row.placeOfSupply,row.item,row.hsn,row.rate,row.taxableValue,row.cgst,row.sgst,row.igst,row.total] as (string|number)[]),
      ]);
    } finally { setAccountingExporting(false); }
  };
  const exportAccountingStatements = async () => {
    setAccountingExporting(true);
    try {
      const result = await loadAccounting();
      const section = (title:string, values:Record<string,number>) => [[title, "Amount"], ...Object.entries(values).map(([key,value]) => [key,value] as (string|number)[])];
      downloadCsv(`accounting-statements-${from}-${to}.csv`, [
        ["Shop", data.shop.name],
        ["From", from],
        ["To", to],
        ["Generated", result.generatedAt],
        [],
        ["Trial balance", "Debit", "Credit"],
        ...result.trialBalance.map(row => [row.account,row.debit,row.credit] as (string|number)[]),
        [],
        ...section("Assets", result.balanceSheet.assets),
        [],
        ...section("Liabilities", result.balanceSheet.liabilities),
        [],
        ...section("Equity", result.balanceSheet.equity),
        [],
        ...section("Operating cash flow", result.cashFlow.operating),
      ]);
    } finally { setAccountingExporting(false); }
  };
  return <>
    <p role="status">{data.summary?.asOf ? `Database totals as of ${new Date(data.summary.asOf).toLocaleString()}` : "Offline totals from this device"}{offline ? " · Cached; reconnect to refresh" : ""}</p>
    <div className="retail-kpis">{[["Sales incl. tax",summary.sales],["Tax collected",summary.tax],["Gross profit",summary.gross],["Expenses",summary.expenses],["Net after recorded expenses",summary.net],["Customer dues (all time)",summary.receivable],["Supplier dues (all time)",summary.payable]].map(([label,value]) => <div className="retail-kpi" key={String(label)}><span>{label}</span><strong>{cash(Number(value))}</strong></div>)}</div>
    <div className="retail-toolbar"><button disabled={exporting || offline} onClick={() => void exportReport()}><Download size={17}/>{exporting ? "Preparing export…" : "Export report CSV"}</button><button disabled={accountingExporting || offline} onClick={() => void exportGstWorkpapers()}>Export GST workpapers</button><button disabled={accountingExporting || offline || !accountingEnabled} onClick={() => void exportAccountingStatements()}>Export accounting statements</button></div>
    {!accountingEnabled && <p className="retail-help">Accounting statements are controlled by the super-admin release switch for this shop.</p>}
    <p className="retail-help">Reports reflect recorded transactions and full-bill returns. GST workpapers include invoice rows, credit-note reversals, HSN summary and GSTR-3B-style totals. They are preparation exports, not direct GSTN filing or accountant-certified books.</p>
    <table><thead><tr><th>Method</th><th>Initial collections</th></tr></thead><tbody>{["cash","upi","card","credit"].map(m => <tr key={m}><td>{m}</td><td>{cash(data.invoices.reduce((n,i) => n + (i.method===m ? Number(i.paid) : i.method==='split' ? Number(i.tenders?.[m as 'cash'|'upi'|'card']||0) : 0),0))}</td></tr>)}</tbody></table>
  </>;
}
