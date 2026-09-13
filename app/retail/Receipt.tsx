"use client";
import { useEffect, useRef } from "react";
import { cash, type Invoice } from "./domain";
import { readAppearance } from './Appearance';

export default function Receipt({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const qr = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    const timer = readAppearance().autoPrint ? window.setTimeout(() => window.print(), 500) : undefined;
    return () => { if(timer)window.clearTimeout(timer); element?.close(); };
  }, []);
  const s = invoice.shop_snapshot.settings;
  useEffect(() => {
    if (s.upi && qr.current)
      void import("qrcode")
        .then(({ default: QRCode }) => {
          if (qr.current)
            return QRCode.toCanvas(
              qr.current,
              `upi://pay?pa=${encodeURIComponent(s.upi!)}&pn=${encodeURIComponent(invoice.shop_snapshot.name)}&cu=INR`,
              { width: 140, margin: 1 },
            );
        })
        .catch(() => {});
  }, [s.upi, invoice.shop_snapshot.name]);
  const share = () => {
    const text = `${invoice.shop_snapshot.name}\nBill ${invoice.number}\n${invoice.lines.map((l) => `${l.name} × ${l.qty}: ${cash(l.total)}`).join("\n")}\nTotal: ${cash(invoice.total)}\nPaid: ${cash(invoice.paid)}\nDue at issue: ${cash(invoice.total - invoice.paid)}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  return (
    <dialog
      ref={ref}
      className="retail-dialog receipt-dialog"
      onCancel={onClose}
      aria-labelledby="receipt-title"
    >
      <div className="receipt-actions">
        <button onClick={onClose}>Close</button>
        <button onClick={() => window.print()}>Print / PDF</button>
        <button onClick={share}>Share on WhatsApp</button>
      </div>
      <article
        className="retail-receipt"
        style={{ maxWidth: s.paper === "58" ? "58mm" : "80mm" }}
      >
        <h2 id="receipt-title">{invoice.shop_snapshot.name}</h2>
        <p>{s.address || invoice.shop_snapshot.area}</p>
        <p>{s.phone}</p>
        {s.gstin && <p>GSTIN: {s.gstin}</p>}
        <h3>{s.gstin ? "Tax invoice" : "Sales receipt"}</h3>
        <p>
          Bill {invoice.number}
          <br />
          {new Date(invoice.created_at).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })}{" "}
          IST
        </p>
        <p>
          Customer: {invoice.customer.name || "Walk-in"}
          {invoice.customer.gstin && (
            <>
              <br />
              GSTIN: {invoice.customer.gstin}
            </>
          )}
          {invoice.customer.address && (
            <>
              <br />
              {invoice.customer.address}
            </>
          )}
        </p>
        {invoice.supply_state && <p>Place of supply: {invoice.supply_state}</p>}
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.id}>
                <td>
                  {l.name}
                  <small>
                    {l.hsn && `HSN ${l.hsn} · `}
                    {cash(l.price)}/{l.unit}
                    {l.discount > 0 && ` · ${l.discount}% off`}
                    {l.rate > 0 && ` · GST ${l.rate}%`}
                  </small>
                </td>
                <td>{l.qty}</td>
                <td>{cash(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl>
          <div>
            <dt>Taxable / net value</dt>
            <dd>{cash(invoice.subtotal)}</dd>
          </div>
          {invoice.tax > 0 &&
            (invoice.interstate ? (
              <div>
                <dt>IGST</dt>
                <dd>{cash(invoice.tax)}</dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>CGST</dt>
                  <dd>{cash(Math.floor(invoice.tax * 50) / 100)}</dd>
                </div>
                <div>
                  <dt>SGST / UTGST</dt>
                  <dd>
                    {cash(invoice.tax - Math.floor(invoice.tax * 50) / 100)}
                  </dd>
                </div>
              </>
            ))}
          <div>
            <dt>Total</dt>
            <dd>
              <strong>{cash(invoice.total)}</strong>
            </dd>
          </div>
          <div>
            <dt>Paid ({invoice.method})</dt>
            <dd>{cash(invoice.paid)}</dd>
            {invoice.method==='split' && Object.entries(invoice.tenders||{}).filter(([,amount])=>Number(amount)>0).map(([method,amount])=><div key={method}><dt>{method.toUpperCase()}</dt><dd>{cash(Number(amount))}</dd></div>)}
          </div>
          <div>
            <dt>Due at issue</dt>
            <dd>{cash(invoice.total - invoice.paid)}</dd>
          </div>
        </dl>
        {s.upi && (
          <>
            <p>UPI ID: {s.upi}</p>
            <canvas ref={qr} aria-label="Shop UPI payment address" />
            <small>
              Enter the agreed amount in your payment app. This QR is not
              payment confirmation.
            </small>
          </>
        )}
        <p>{s.receiptNote || "Thank you for shopping with us"}</p>
        <p className="receipt-sign">Authorized signatory: __________________</p>
      </article>
    </dialog>
  );
}
