import { jsPDF } from "jspdf";
import type { Invoice } from "./domain";
import { receiptText } from "./thermal-printer";

const money = (val: number) => `Rs. ${(Number(val) || 0).toFixed(2)}`;

const clean = (val: unknown) =>
  String(val ?? "")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function generateInvoicePdfDoc(invoice: Invoice): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Shop Branding Header ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(22, 101, 52); // #166534 emerald green
  const shopName = clean(invoice.shop_snapshot.name) || "RETAIL STORE";
  doc.text(shopName, margin, y + 6);

  // Invoice Title Badge (Top Right)
  const isGst = Boolean(invoice.shop_snapshot.settings.gstin);
  const titleText = isGst ? "TAX INVOICE" : "RETAIL INVOICE";
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  doc.text(titleText, pageWidth - margin, y + 6, { align: "right" });

  y += 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // #6b7280

  const s = invoice.shop_snapshot.settings;
  const shopAddr = clean(s.address || invoice.shop_snapshot.area);
  if (shopAddr) {
    doc.text(shopAddr, margin, y);
    y += 4.5;
  }
  const shopContact = [
    s.phone ? `Phone: ${clean(s.phone)}` : "",
    s.gstin ? `GSTIN: ${clean(s.gstin)}` : "",
  ]
    .filter(Boolean)
    .join("  |  ");
  if (shopContact) {
    doc.text(shopContact, margin, y);
    y += 4.5;
  }

  // Divider Line
  y += 2;
  doc.setDrawColor(209, 213, 219); // #d1d5db
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // --- Customer & Invoice Details (Two Columns) ---
  const boxTop = y;
  const colWidth = (contentWidth - 6) / 2;

  // Left column: Customer Details
  doc.setFillColor(249, 250, 251); // #f9fafb
  doc.roundedRect(margin, boxTop, colWidth, 32, 2, 2, "F");
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("BILLED TO:", margin + 4, boxTop + 5.5);

  doc.setFontSize(10.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(17, 24, 39);
  const custName = clean(invoice.customer.name) || "Walk-in Customer";
  doc.text(custName, margin + 4, boxTop + 11);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  let custY = boxTop + 16;
  if (invoice.customer.phone) {
    doc.text(`Phone: ${clean(invoice.customer.phone)}`, margin + 4, custY);
    custY += 4.5;
  }
  if (invoice.customer.address) {
    doc.text(`Address: ${clean(invoice.customer.address)}`, margin + 4, custY);
    custY += 4.5;
  }
  if (invoice.customer.gstin) {
    doc.text(`GSTIN: ${clean(invoice.customer.gstin)}`, margin + 4, custY);
    custY += 4.5;
  }

  // Right column: Invoice Metadata
  const rightX = margin + colWidth + 6;
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(rightX, boxTop, colWidth, 32, 2, 2, "F");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("INVOICE DETAILS:", rightX + 4, boxTop + 5.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);

  const billDate = new Date(invoice.created_at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const rightMeta = [
    ["Invoice No:", clean(invoice.number)],
    ["Date & Time:", `${billDate} IST`],
    ["Payment Mode:", (invoice.method || "Cash").toUpperCase()],
    invoice.supply_state ? ["Place of Supply:", clean(invoice.supply_state)] : null,
  ].filter(Boolean) as [string, string][];

  let metaY = boxTop + 11;
  rightMeta.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(label, rightX + 4, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text(value, rightX + colWidth - 4, metaY, { align: "right" });
    metaY += 5;
  });

  y = boxTop + 36;

  // --- Line Items Table Header ---
  const cols = [
    { label: "#", width: 10, align: "center" as const },
    { label: "Item Description", width: 68, align: "left" as const },
    { label: "HSN", width: 20, align: "left" as const },
    { label: "Qty", width: 18, align: "center" as const },
    { label: "Rate", width: 20, align: "right" as const },
    { label: "Disc %", width: 16, align: "right" as const },
    { label: "GST %", width: 14, align: "right" as const },
    { label: "Total", width: 24, align: "right" as const },
  ];

  doc.setFillColor(243, 244, 246); // #f3f4f6
  doc.rect(margin, y, contentWidth, 7.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(55, 65, 81);

  let currentX = margin;
  cols.forEach((col) => {
    const textX =
      col.align === "right"
        ? currentX + col.width - 2
        : col.align === "center"
          ? currentX + col.width / 2
          : currentX + 2;
    doc.text(col.label, textX, y + 5.2, { align: col.align });
    currentX += col.width;
  });

  y += 7.5;

  // Table Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(31, 41, 55);

  invoice.lines.forEach((line, index) => {
    // Check if new page is needed
    if (y > pageHeight - 65) {
      doc.addPage();
      y = margin;
    }

    const rowHeight = 7;
    // Row separator
    doc.setDrawColor(243, 244, 246);
    doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

    let rowX = margin;
    const itemNum = String(index + 1);
    const itemName = clean(line.name).slice(0, 36);
    const hsn = clean(line.hsn || "-");
    const qtyUnit = `${line.qty} ${line.unit || "pcs"}`;
    const rate = (Number(line.price) || 0).toFixed(2);
    const discount = line.discount > 0 ? `${line.discount}%` : "-";
    const gstRate = line.rate > 0 ? `${line.rate}%` : "0%";
    const total = (Number(line.total) || 0).toFixed(2);

    const values = [
      { text: itemNum, col: cols[0] },
      { text: itemName, col: cols[1] },
      { text: hsn, col: cols[2] },
      { text: qtyUnit, col: cols[3] },
      { text: rate, col: cols[4] },
      { text: discount, col: cols[5] },
      { text: gstRate, col: cols[6] },
      { text: total, col: cols[7] },
    ];

    values.forEach(({ text, col }) => {
      const textX =
        col.align === "right"
          ? rowX + col.width - 2
          : col.align === "center"
            ? rowX + col.width / 2
            : rowX + 2;
      doc.text(text, textX, y + 5, { align: col.align });
      rowX += col.width;
    });

    y += rowHeight;
  });

  // Table bottom border
  doc.setDrawColor(209, 213, 219);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Check page height for totals
  if (y > pageHeight - 75) {
    doc.addPage();
    y = margin;
  }

  // --- Summary & Totals Block ---
  const summaryWidth = 85;
  const summaryX = pageWidth - margin - summaryWidth;
  let summaryY = y;

  const rows: [string, string, boolean?][] = [
    ["Taxable / Net Value:", money(invoice.subtotal)],
  ];

  if (invoice.tax > 0) {
    if (invoice.interstate) {
      rows.push(["IGST:", money(invoice.tax)]);
    } else {
      const halfTax = Math.floor(invoice.tax * 50) / 100;
      rows.push(["CGST:", money(halfTax)]);
      rows.push(["SGST / UTGST:", money(invoice.tax - halfTax)]);
    }
  }

  rows.push(["Grand Total:", money(invoice.total), true]);
  rows.push([`Paid (${(invoice.method || "Cash").toUpperCase()}):`, money(invoice.paid)]);

  const due = Math.max(0, invoice.total - invoice.paid);
  if (due > 0 || invoice.method === "credit") {
    rows.push(["Balance Due:", money(due), true]);
  }

  rows.forEach(([label, value, isBold]) => {
    if (isBold) {
      doc.setFillColor(240, 253, 244); // #f0fdf4 light emerald
      doc.roundedRect(summaryX - 2, summaryY - 1, summaryWidth + 2, 7.5, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(22, 101, 52);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
    }
    doc.text(label, summaryX, summaryY + 4.5);
    doc.text(value, pageWidth - margin, summaryY + 4.5, { align: "right" });
    summaryY += isBold ? 8.5 : 5.5;
  });

  // Left Note / Terms (aligned alongside summary)
  const leftY = y;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  const note = clean(s.receiptNote) || "Thank you for shopping with us!";
  doc.text(note, margin, leftY + 5);

  if (s.upi) {
    doc.text(`UPI ID for payment: ${clean(s.upi)}`, margin, leftY + 11);
  }

  // Signatory
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.3);
  doc.line(margin, summaryY + 12, margin + 50, summaryY + 12);
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text("Authorized Signatory", margin, summaryY + 16);

  return doc;
}

export function generateInvoicePdfBlob(invoice: Invoice): Blob {
  const doc = generateInvoicePdfDoc(invoice);
  return doc.output("blob");
}

export function generateInvoicePdfFile(invoice: Invoice): File {
  const blob = generateInvoicePdfBlob(invoice);
  const fileName = `Bill-${invoice.number || "invoice"}.pdf`;
  return new File([blob], fileName, { type: "application/pdf" });
}

export function downloadInvoicePdf(invoice: Invoice) {
  const blob = generateInvoicePdfBlob(invoice);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bill-${invoice.number || "invoice"}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatWhatsAppPhone(phone: string): string {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

export async function shareInvoicePdf(
  invoice: Invoice,
  targetPhone?: string
): Promise<{ sharedViaNative: boolean; downloaded: boolean; targetPhone?: string }> {
  const file = generateInvoicePdfFile(invoice);
  const title = `Bill ${invoice.number} - ${invoice.shop_snapshot.name}`;
  const text = receiptText(invoice);

  // Check if navigator.canShare supports files
  if (
    typeof navigator !== "undefined" &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title,
        text,
        files: [file],
      });
      return { sharedViaNative: true, downloaded: false, targetPhone };
    } catch (err) {
      // User cancelled native share sheet
      if ((err as Error).name === "AbortError") {
        return { sharedViaNative: false, downloaded: false, targetPhone };
      }
    }
  }

  // Desktop or browsers without native file sharing support:
  // 1. Download the PDF file automatically
  downloadInvoicePdf(invoice);

  // 2. Open WhatsApp with formatted bill message and note directed to specific phone if available
  const cleanPhone = formatWhatsAppPhone(targetPhone || invoice.customer?.phone || "");
  const waText = `${text}\n\n[Bill PDF has been downloaded. Please attach it here.]`;
  const waUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waText)}`
    : `https://wa.me/?text=${encodeURIComponent(waText)}`;

  window.open(waUrl, "_blank", "noopener,noreferrer");

  return { sharedViaNative: false, downloaded: true, targetPhone: cleanPhone };
}

