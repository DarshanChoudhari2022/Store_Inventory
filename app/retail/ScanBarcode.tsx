"use client";
import { useEffect, useRef, useState } from "react";
export default function ScanBarcode({
  onFound,
  onClose,
}: {
  onFound: (code: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const foundRef = useRef(onFound);
  useEffect(() => {
    foundRef.current = onFound;
  }, [onFound]);
  useEffect(() => {
    let alive = true;
    let stop: (() => void) | undefined;
    const dialogElement = dialog.current;
    const videoElement = video.current;
    dialogElement?.showModal();
    void import("@zxing/browser")
      .then(async ({ BrowserMultiFormatReader }) => {
        if (!alive || !videoElement) return;
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoElement,
          (result, _error, controls) => {
            if (result && alive) {
              alive = false;
              controls.stop();
              void Promise.resolve(foundRef.current(result.getText())).catch((e) => {
                setError(e instanceof Error ? e.message : "Could not use scanned barcode.");
              });
            }
          },
        );
        stop = () => controls.stop();
        if (!alive) controls.stop();
      })
      .catch((e) => {
        if (alive)
          setError(
            e.message ||
              "Camera unavailable. Use a USB scanner or enter the barcode.",
          );
      });
    return () => {
      alive = false;
      stop?.();
      const stream = videoElement?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
      dialogElement?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="retail-dialog"
      onCancel={onClose}
      aria-labelledby="scan-title"
    >
      <header>
        <h2 id="scan-title">Scan product barcode</h2>
        <button onClick={onClose}>Close</button>
      </header>
      <video
        ref={video}
        playsInline
        muted
        style={{ width: "100%", borderRadius: 8 }}
      />
      {error ? (
        <p role="alert" className="retail-error">
          {error}
        </p>
      ) : (
        <p>
          Point the camera at a product barcode. The camera stops after a
          successful scan.
        </p>
      )}
    </dialog>
  );
}
