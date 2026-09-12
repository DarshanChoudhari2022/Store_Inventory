"use client";
import { useEffect, useRef, useState } from "react";
import { cash, productName, type Product } from "./domain";
export default function BarcodeLabel({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    svg = useRef<SVGSVGElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = ref.current;
    element?.showModal();
    void import("jsbarcode")
      .then(({ default: render }) => {
        if (svg.current)
          render(svg.current, product.barcode, {
            format: "CODE128",
            width: 1.3,
            height: 38,
            fontSize: 12,
            margin: 4,
          });
      })
      .catch(() =>
        setError(
          "This barcode cannot be printed as Code 128. Check the barcode value.",
        ),
      );
    return () => element?.close();
  }, [product.barcode]);
  return (
    <dialog
      ref={ref}
      className="retail-dialog receipt-dialog"
      onCancel={onClose}
      aria-labelledby="barcode-title"
    >
      <div className="receipt-actions">
        <button onClick={onClose}>Close</button>
        <button disabled={!!error} onClick={() => window.print()}>
          Print label
        </button>
      </div>
      <article className="retail-receipt" style={{ width: "50mm" }}>
        <h3 id="barcode-title">{productName(product)}</h3>
        <p>
          {cash(product.default_selling_price)} / {product.unit}
        </p>
        {product.mrp != null && <p>MRP {cash(product.mrp)}</p>}
        <svg
          ref={svg}
          style={{ width: "100%", height: "auto" }}
          aria-label={`Barcode ${product.barcode}`}
        />
        {error && <p role="alert">{error}</p>}
      </article>
    </dialog>
  );
}
