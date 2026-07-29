"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Field, Modal, TextInput } from "@/components/ui";

/* ── Native BarcodeDetector type shim ────────────────────────────────────
 * The TS DOM lib may not include BarcodeDetector (it's a recent addition).
 * This shim surfaces the subset we need without requiring a @types package.
 */
declare global {
  interface BarcodeDetectorOptions {
    formats?: BarcodeFormat[];
  }
  type BarcodeFormat =
    | "aztec"
    | "code_128"
    | "code_39"
    | "code_93"
    | "codabar"
    | "data_matrix"
    | "ean_13"
    | "ean_8"
    | "itf"
    | "pdf417"
    | "qr_code"
    | "upc_a"
    | "upc_e";
  interface DetectedBarcode {
    boundingBox: DOMRectReadOnly;
    rawValue: string;
    format: BarcodeFormat;
    cornerPoints: readonly { x: number; y: number }[];
  }
  interface BarcodeDetector {
    detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
  }
  interface BarcodeDetectorConstructor {
    new (options?: BarcodeDetectorOptions): BarcodeDetector;
    getSupportedFormats(): Promise<BarcodeFormat[]>;
  }
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const SCAN_INTERVAL_MS = 300;

const SUPPORTED_FORMATS: BarcodeFormat[] = [
  "code_128",
  "code_39",
  "ean_13",
  "ean_8",
  "qr_code",
  "data_matrix",
];

/* ── Component ──────────────────────────────────────────────────────────── */

export function BarcodeScannerModal({
  open,
  onClose,
  onScan,
  title = "Scan tube barcode",
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}) {
  /* ── state ──────────────────────────────────────────────────────────── */
  const [mode, setMode] = useState<"loading" | "camera" | "manual" | "error">(
    "loading"
  );
  const [manualCode, setManualCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [insecureText, setInsecureText] = useState("");

  /* ── refs ───────────────────────────────────────────────────────────── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aliveRef = useRef(false); // guards decode-after-close

  /* ── helpers ────────────────────────────────────────────────────────── */

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    aliveRef.current = true;
    setMode("loading");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!aliveRef.current) {
        // component closed while permission was being granted
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode("camera");
    } catch (err: unknown) {
      if (!aliveRef.current) return;
      setMode("manual");
      setErrorMsg(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied"
          : "Could not access the camera"
      );
    }
  }, []);

  const handleScan = useCallback(
    async (video: HTMLVideoElement) => {
      if (!aliveRef.current) return;
      const Detector = window.BarcodeDetector;
      if (!Detector) return; // already in manual mode

      try {
        const detector = new Detector({ formats: SUPPORTED_FORMATS });
        const codes = await detector.detect(video);
        if (!aliveRef.current) return;
        if (codes.length > 0 && codes[0].rawValue) {
          onScan(codes[0].rawValue);
          onClose();
        }
      } catch {
        // transient — try again next interval
      }
    },
    [onScan, onClose]
  );

  /* ── effects ────────────────────────────────────────────────────────── */

  // Reset state when modal opens / closes
  useEffect(() => {
    if (!open) {
      stopCamera();
      aliveRef.current = false;
      setMode("loading");
      setManualCode("");
      setErrorMsg("");
      setInsecureText("");
      return;
    }

    // Detect insecure context (non-HTTPS / localhost may still work in some
    // browsers, but getUserMedia is undefined on truly insecure origins).
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setMode("manual");
      setInsecureText(
        "Camera is not available on this connection (non-HTTPS). Please enter the barcode manually."
      );
      return;
    }

    // Feature-detect BarcodeDetector
    if (typeof window.BarcodeDetector === "undefined") {
      setMode("manual");
      setInsecureText(
        "Barcode scanning is not supported by your browser. Please enter the code manually."
      );
      return;
    }

    // Start camera
    startCamera();
  }, [open, startCamera, stopCamera]);

  // Set up the scan interval once camera mode is active
  useEffect(() => {
    if (mode !== "camera" || !videoRef.current) return;

    const video = videoRef.current;
    const tick = () => handleScan(video);
    intervalRef.current = setInterval(tick, SCAN_INTERVAL_MS);

    // Ensure video plays
    if (video.paused) {
      video.play().catch(() => {
        // silent — the user will see the fallback option
      });
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [mode, handleScan]);

  // Unmount guard
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  /* ── manual-submit handler ──────────────────────────────────────────── */
  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (trimmed.length > 0) {
      onScan(trimmed);
      onClose();
    }
  };

  /* ── render ─────────────────────────────────────────────────────────── */

  const isCamera = mode === "camera";
  const isLoading = mode === "loading";
  const isManual = mode === "manual";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        isManual ? (
          <Button
            variant="primary"
            onClick={handleManualSubmit}
            disabled={manualCode.trim().length === 0}
          >
            Use this code
          </Button>
        ) : undefined
      }
    >
      <>
        {/* ── Camera view ──────────────────────────────────────────────── */}
        {isCamera && (
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "4 / 3",
              maxHeight: "50vh",
              borderRadius: "var(--cm-radius-lg)",
              overflow: "hidden",
              background: "#000",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />

            {/* Viewfinder frame — dimmed overlay with a clear centre box */}
            <svg
              viewBox="0 0 100 100"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }}
              aria-hidden="true"
            >
              <defs>
                <mask id="cm-barcode-viewfinder">
                  <rect x="0" y="0" width="100" height="100" fill="white" />
                  <rect
                    x="15"
                    y="25"
                    width="70"
                    height="50"
                    rx="3"
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100"
                height="100"
                fill="rgba(0,0,0,0.45)"
                mask="url(#cm-barcode-viewfinder)"
              />
              {/* Corner brackets */}
              <rect
                x="13"
                y="23"
                width="10"
                height="2"
                rx="1"
                fill="#fff"
              />
              <rect
                x="13"
                y="23"
                width="2"
                height="10"
                rx="1"
                fill="#fff"
              />
              <rect
                x="77"
                y="23"
                width="10"
                height="2"
                rx="1"
                fill="#fff"
              />
              <rect
                x="85"
                y="23"
                width="2"
                height="10"
                rx="1"
                fill="#fff"
              />
              <rect
                x="13"
                y="73"
                width="10"
                height="2"
                rx="1"
                fill="#fff"
              />
              <rect
                x="13"
                y="65"
                width="2"
                height="10"
                rx="1"
                fill="#fff"
              />
              <rect
                x="77"
                y="73"
                width="10"
                height="2"
                rx="1"
                fill="#fff"
              />
              <rect
                x="85"
                y="65"
                width="2"
                height="10"
                rx="1"
                fill="#fff"
              />
            </svg>
          </div>
        )}

        {/* ── Loading state ────────────────────────────────────────────── */}
        {isLoading && (
          <p style={{ textAlign: "center", color: "var(--cm-ink-3)" }}>
            Requesting camera access...
          </p>
        )}

        {/* ── Manual / fallback entry ──────────────────────────────────── */}
        {isManual && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--cm-3)" }}>
            {insecureText && (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--cm-text-sm)",
                  color: "var(--cm-ink-3)",
                }}
              >
                {insecureText}
              </p>
            )}
            {errorMsg && (
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--cm-text-sm)",
                  color: "var(--cm-danger)",
                }}
              >
                {errorMsg}
              </p>
            )}
            <Field label="Barcode number" id="barcode-manual">
              <TextInput
                id="barcode-manual"
                placeholder="Enter barcode number"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualSubmit();
                }}
                autoFocus
              />
            </Field>
          </div>
        )}

        {/* ── Hint text (always visible when camera is active) ─────────── */}
        {isCamera && (
          <p
            style={{
              margin: "var(--cm-3) 0 0",
              textAlign: "center",
              fontSize: "var(--cm-text-sm)",
              color: "var(--cm-ink-3)",
            }}
          >
            Point at the tube barcode
          </p>
        )}
      </>
    </Modal>
  );
}