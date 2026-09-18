"use client";
import { useEffect, useRef, useState } from "react";
import { cash, type Invoice } from "./domain";
import { playReceiptSound, readAppearance } from './Appearance';
import { printEscPosBluetooth, receiptText } from "./thermal-printer";
import { downloadInvoicePdf, shareInvoicePdf } from "./invoice-pdf";

export default function Receipt({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const qr = useRef<HTMLCanvasElement>(null);
  const [printerStatus, setPrinterStatus] = useState("");
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    const appearance = readAppearance();
    playReceiptSound();
    const timer = appearance.autoPrint ? window.setTimeout(() => window.print(), 500) : undefined;
    return () => { if(timer)window.clearTimeout(timer); element?.close(); };
  }, []);
  const s = invoice.shop_snapshot.settings;
  const appearance = readAppearance();
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
  const share = async () => {
    setSharing(true);
    try {
      const result = await shareInvoicePdf(invoice);
      if (result.downloaded) {
        setPrinterStatus("Bill PDF downloaded. Attach the downloaded PDF in WhatsApp.");
      } else if (result.sharedViaNative) {
        setPrinterStatus("Bill PDF shared.");
      }
    } catch (e) {
      setPrinterStatus(e instanceof Error ? e.message : "Could not share PDF.");
    } finally {
      setSharing(false);
    }
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
        <button onClick={() => window.print()}>Print</button>
        <button onClick={() => downloadInvoicePdf(invoice)}>Download PDF</button>
        <button onClick={async () => {
          setPrinterStatus("Connecting to Bluetooth printer…");
          try { await printEscPosBluetooth(receiptText(invoice)); setPrinterStatus("Sent to thermal printer."); }
          catch (error) { setPrinterStatus(error instanceof Error ? error.message : "Could not print to Bluetooth printer."); }
        }}>Bluetooth thermal print</button>
        <button disabled={sharing} onClick={share}>{sharing ? "Sharing PDF…" : "Share PDF on WhatsApp"}</button>
      </div>
      {printerStatus && <p className="retail-notice" role="status">{printerStatus}</p>}
      <article
        className="retail-receipt"
        style={{ maxWidth: s.paper === "58" ? "58mm" : "80mm" }}
      >
        {appearance.receiptLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="receipt-logo" src={appearance.receiptLogo} alt="" />
        )}
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
