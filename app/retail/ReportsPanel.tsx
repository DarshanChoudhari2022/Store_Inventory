"use client";
import { Download } from "lucide-react";
import { cash, downloadCsv, type Workspace } from "./domain";

type Props = { data: Workspace; summary: ReturnType<typeof import("./domain").report> & { asOf?: string }; from: string; to: string; offline: boolean };

export default function ReportsPanel({ data, summary, from, to, offline }: Props) {
  const reportRows = [
    ["Shop", data.shop.name], ["From", from], ["To", to],
    ...Object.entries(summary).map(([key, value]) => [key, value] as (string | number)[]), [],
    ["Bill", "Date", "Net", "Tax", "Total", "Cost", "Paid", "Method"],
    ...data.invoices.map(i => [i.number, i.created_at, i.subtotal, i.tax, i.total, i.cost, i.paid, i.method] as (string | number)[]), [],
    ["Returns", "Date", "Total", "Tax", "Refund"],
    ...data.returns.map(r => [r.number, r.created_at, r.total, r.tax, r.refund] as (string | number)[]),
  ];
  const gstRows = [
    ["Bill", "Date", "Customer GSTIN", "Place of supply", "Taxable value", "CGST", "SGST/UTGST", "IGST", "Total"],
    ...data.invoices.map(i => [i.number, i.created_at, i.customer.gstin || "", i.supply_state, i.subtotal, i.interstate ? 0 : Math.floor(i.tax * 50) / 100, i.interstate ? 0 : i.tax - Math.floor(i.tax * 50) / 100, i.interstate ? i.tax : 0, i.total] as (string | number)[]),
  ];
  return <>
    <p role="status">{data.summary?.asOf ? `Database totals as of ${new Date(data.summary.asOf).toLocaleString()}` : "Offline totals from this device"}{offline ? " · Cached; reconnect to refresh" : ""}</p>
    <div className="retail-kpis">{[["Sales incl. tax",summary.sales],["Tax collected",summary.tax],["Gross profit",summary.gross],["Expenses",summary.expenses],["Net after recorded expenses",summary.net],["Customer dues (all time)",summary.receivable],["Supplier dues (all time)",summary.payable]].map(([label,value]) => <div className="retail-kpi" key={String(label)}><span>{label}</span><strong>{cash(Number(value))}</strong></div>)}</div>
    <div className="retail-toolbar"><button onClick={() => downloadCsv(`report-${from}-${to}.csv`, reportRows)}><Download size={17}/>Export report CSV</button><button onClick={() => downloadCsv(`gst-sales-${from}-${to}.csv`, gstRows)}>Export tax sales register</button></div>
    <p className="retail-help">Reports reflect recorded transactions and full-bill returns. Legacy single-item sales have no payment method or GST breakdown. The tax sales register is an accounting export, not a filed GST return; returns are listed separately in the report export.</p>
    <table><thead><tr><th>Method</th><th>Initial collections</th></tr></thead><tbody>{["cash","upi","card","credit"].map(m => <tr key={m}><td>{m}</td><td>{cash(data.invoices.reduce((n,i) => n + (i.method===m ? Number(i.paid) : i.method==='split' ? Number(i.tenders?.[m as 'cash'|'upi'|'card']||0) : 0),0))}</td></tr>)}</tbody></table>
  </>;
}
