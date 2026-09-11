"use client";
import { useEffect, useRef, useState } from "react";
import type { CartLine, Product } from "./domain";

export default function PurchaseScan({
  products,
  onReview,
  onClose,
}: {
  products: Product[];
  onReview: (lines: CartLine[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [progress, setProgress] = useState(""),
    [rows, setRows] = useState<(CartLine & { source: string })[]>([]);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  async function scan(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    let worker:
      | Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>
      | undefined;
    try {
      if (files.length > 5) throw new Error("Choose up to five bill images.");
      for (const f of Array.from(files)) {
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 8_000_000
        )
          throw new Error("Use JPG, PNG or WebP images under 8 MB each.");
      }
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (m) =>
          setProgress(`${m.status} ${Math.round((m.progress || 0) * 100)}%`),
      });
      let content = "";
      for (const file of Array.from(files)) {
        const r = await worker.recognize(file);
        content += r.data.text + "\n";
      }
      setText(content);
      setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not scan this image");
    } finally {
      await worker?.terminate();
      setBusy(false);
    }
  }
  function extract() {
    const found: (CartLine & { source: string })[] = [];
    for (const line of text.split("\n")) {
      const numbers = line.match(/\d+(?:\.\d+)?/g) || [];
      if (numbers.length < 2) continue;
      const normalized = line.toLowerCase();
      const p = products.find(
        (p) =>
          (p.barcode && normalized.includes(p.barcode)) ||
          normalized.includes(p.name.toLowerCase()),
      );
      if (p)
        found.push({
          id: p.id,
          qty: Number(numbers[numbers.length - 2]),
          price: Number(numbers[numbers.length - 1]),
          discount: 0,
          source: line,
        });
    }
    setRows(found);
    if (!found.length)
      setError(
        "No catalog products matched. Correct the extracted names or enter this purchase manually.",
      );
    else setError("");
  }
  return (
    <dialog
      ref={dialog}
      className="retail-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else onClose();
      }}
      aria-labelledby="purchase-scan-title"
    >
      <header>
        <h2 id="purchase-scan-title">Scan supplier bill</h2>
        <button disabled={busy} onClick={onClose}>
          Close
        </button>
      </header>
      <p>
        OCR reads images on this device. First use downloads the recognition
        engine. Check every quantity and rate before adding it to your purchase.
      </p>
      <label className="retail-upload">
        Choose bill images
        <input
          disabled={busy}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void scan(e.target.files)}
        />
      </label>
      {busy && <p role="status">{progress}</p>}
      {error && (
        <p className="retail-error" role="alert">
          {error}
        </p>
      )}
      {text && (
        <>
          <label>
            Extracted text
            <textarea
              rows={9}
              value={text}
              onChange={(e) => setText(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #cddbd1",
                padding: 12,
                marginBlock: 12,
              }}
            />
          </label>
          <button onClick={extract}>Match catalog products</button>
          <p>
            Matching uses your product names/barcodes. Suggested quantity and
            rate use the last two numbers in a line and may need correction.
          </p>
          {rows.map((r, i) => (
            <div className="retail-panel" key={i}>
              <small>{r.source}</small>
              <label>
                Product
                <select
                  value={r.id}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x, j) =>
                        j === i ? { ...x, id: e.target.value } : x,
                      ),
                    )
                  }
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="retail-form-grid">
                <label>
                  Quantity
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={r.qty}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, qty: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Unit rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={r.price}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x, j) =>
                          j === i ? { ...x, price: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <button
                onClick={() =>
                  setRows((prev) => prev.filter((_, j) => j !== i))
                }
              >
                Remove line
              </button>
            </div>
          ))}
          {rows.length > 0 && (
            <button
              className="primary"
              onClick={() => {
                if (
                  rows.some(
                    (r) =>
                      !Number.isFinite(r.qty) ||
                      r.qty <= 0 ||
                      !Number.isFinite(r.price) ||
                      r.price < 0,
                  )
                ) {
                  setError("Check quantities and rates.");
                  return;
                }
                if (new Set(rows.map((r) => r.id)).size !== rows.length) {
                  setError("Combine duplicate product lines before adding.");
                  return;
                }
                onReview(
                  rows.map(({ id, qty, price, discount }) => ({
                    id,
                    qty,
                    price,
                    discount,
                  })),
                );
              }}
            >
              Use reviewed lines in purchase
            </button>
          )}
        </>
      )}
    </dialog>
  );
}
