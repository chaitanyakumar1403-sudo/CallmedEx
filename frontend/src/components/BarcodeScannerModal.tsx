"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
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

/* ── Possible Camera Scanning Modes ──────────────────────────────────────
 * 1. native     → BarcodeDetector API (Chromium-based browsers)
 * 2. html5_qrcode → html5-qrcode library fallback (Firefox, Safari, others)
 * 3. manual     → text input (last resort, or if camera is denied)
 * ──────────────────────────────────────────────────────────────────────── */
type ScanMode = "loading" | "native" | "html5_qrcode" | "manual" | "error";

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
  const [mode, setMode] = useState<ScanMode>("loading");
  const [manualCode, setManualCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [hintText, setHintText] = useState("");

  /* ── refs ───────────────────────────────────────────────────────────── */
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const html5Ref = useRef<Html5Qrcode | null>(null);
  const scanContainerRef = useRef<HTMLDivElement>(null);
  const aliveRef = useRef(false); // guards decode-after-close

  /* ── helpers ────────────────────────────────────────────────────────── */

  const stopAllScanners = useCallback(() => {
    // Stop native interval scanner
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // Stop native camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    // Stop html5-qrcode scanner
    if (html5Ref.current) {
      try {
        html5Ref.current.stop().catch(() => {});
      } catch {
        // already stopped
      }
      html5Ref.current = null;
    }
  }, []);

  /** Attempt native BarcodeDetector + getUserMedia scanning. */
  const startNativeScanner = useCallback(async () => {
    aliveRef.current = true;
    setMode("loading");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (!aliveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      // The <video> element doesn't exist yet — it only mounts once mode
      // becomes "native" below. Attaching streamRef.current to it happens
      // in the mode-driven effect further down, once it's actually in the DOM.
      streamRef.current = stream;
      setMode("native");
      setHintText("");
    } catch (err: unknown) {
      if (!aliveRef.current) return;
      // If camera is denied, go to manual directly
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setMode("manual");
        setErrorMsg("Camera permission was denied. Please enter the code manually.");
        return;
      }
      // Otherwise, try html5-qrcode fallback
      setHintText("Native camera access failed — trying library-based scanner…");
      startHtml5Scanner();
    }
  }, []);

  /** Start html5-qrcode library-based scanner (works in all browsers). */
  const startHtml5Scanner = useCallback(async () => {
    if (!aliveRef.current) return;
    setMode("loading");

    // Small delay so the UI can render the container before scanner attaches
    await new Promise((r) => setTimeout(r, 100));
    if (!aliveRef.current || !scanContainerRef.current) {
      setMode("manual");
      setErrorMsg("Could not initialise camera scanner.");
      return;
    }

    const containerId = "cm-html5-qrcode-container";
    // Ensure the container has an ID
    scanContainerRef.current.id = containerId;

    try {
      const html5 = new Html5Qrcode(containerId, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.EAN_13,
        ],
      });
      html5Ref.current = html5;
      await html5.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
        },
        (decodedText: string) => {
          // On each successful decode
          if (aliveRef.current && decodedText) {
            onScan(decodedText);
            onClose();
          }
        },
        () => {
          // decode failure — silently retry
        }
      );
      if (aliveRef.current) {
        setMode("html5_qrcode");
        setHintText("Library-based scanning active");
      }
    } catch (err: unknown) {
      if (!aliveRef.current) return;
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied"
          : "Camera is not available on this device. Enter the barcode manually.";
      setMode("manual");
      setErrorMsg(msg);
    }
  }, [onScan, onClose]);

  const handleScan = useCallback(
    async (video: HTMLVideoElement) => {
      if (!aliveRef.current) return;
      const Detector = window.BarcodeDetector;
      if (!Detector) return; // already in html5-qrcode or manual mode

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
      stopAllScanners();
      aliveRef.current = false;
      setMode("loading");
      setManualCode("");
      setErrorMsg("");
      setHintText("");
      return;
    }

    // Detect insecure context (non-HTTPS / localhost may still work in some
    // browsers, but getUserMedia is undefined on truly insecure origins).
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      // Try html5-qrcode anyway — it sometimes works on insecure contexts
      startHtml5Scanner();
      return;
    }

    // If BarcodeDetector is available, prefer the native path (faster, lower latency)
    if (typeof window.BarcodeDetector !== "undefined") {
      startNativeScanner();
    } else {
      // BarcodeDetector not supported → use html5-qrcode library
      startHtml5Scanner();
    }
  }, [open, startNativeScanner, startHtml5Scanner, stopAllScanners]);

  // Set up the native scan interval when native camera mode is active
  useEffect(() => {
    if (mode !== "native" || !videoRef.current) return;

    const video = videoRef.current;

    // The <video> element only mounts once mode flips to "native", which
    // happens after the stream was captured — so the srcObject assignment
    // in startNativeScanner ran against a still-null ref and silently no-op'd.
    // Attach it here, now that the element actually exists in the DOM.
    if (streamRef.current && video.srcObject !== streamRef.current) {
      video.srcObject = streamRef.current;
    }

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
      stopAllScanners();
    };
  }, [stopAllScanners]);

  /* ── manual-submit handler ──────────────────────────────────────────── */
  const handleManualSubmit = () => {
    const trimmed = manualCode.trim();
    if (trimmed.length > 0) {
      onScan(trimmed);
      onClose();
    }
  };

  /* ── render ─────────────────────────────────────────────────────────── */

  const isNativeCamera = mode === "native";
  const isHtml5 = mode === "html5_qrcode";
  const isLoading = mode === "loading";
  const isManual = mode === "manual";
  const isError = mode === "error";

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
        {/* ── Native Camera view ───────────────────────────────────────── */}
        {isNativeCamera && (
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
              <rect x="13" y="23" width="10" height="2" rx="1" fill="#fff" />
              <rect x="13" y="23" width="2" height="10" rx="1" fill="#fff" />
              <rect x="77" y="23" width="10" height="2" rx="1" fill="#fff" />
              <rect x="85" y="23" width="2" height="10" rx="1" fill="#fff" />
              <rect x="13" y="73" width="10" height="2" rx="1" fill="#fff" />
              <rect x="13" y="65" width="2" height="10" rx="1" fill="#fff" />
              <rect x="77" y="73" width="10" height="2" rx="1" fill="#fff" />
              <rect x="85" y="65" width="2" height="10" rx="1" fill="#fff" />
            </svg>
          </div>
        )}

        {/* ── html5-qrcode Library Camera View ─────────────────────────── */}
        {isHtml5 && (
          <div
            ref={scanContainerRef}
            style={{
              width: "100%",
              maxHeight: "50vh",
              borderRadius: "var(--cm-radius-lg)",
              overflow: "hidden",
              background: "#000",
            }}
          />
        )}

        {/* ── Loading state ────────────────────────────────────────────── */}
        {isLoading && (
          <p style={{ textAlign: "center", color: "var(--cm-ink-3)" }}>
            Requesting camera access...
          </p>
        )}

        {/* ── Error state ──────────────────────────────────────────────── */}
        {isError && (
          <p
            style={{
              textAlign: "center",
              color: "var(--cm-danger)",
              fontSize: "var(--cm-text-sm)",
            }}
          >
            {errorMsg}
          </p>
        )}

        {/* ── Manual / fallback entry ──────────────────────────────────── */}
        {isManual && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--cm-3)",
            }}
          >
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

        {/* ── Hint text ────────────────────────────────────────────────── */}
        {(isNativeCamera || isHtml5) && (
          <p
            style={{
              margin: "var(--cm-3) 0 0",
              textAlign: "center",
              fontSize: "var(--cm-text-sm)",
              color: "var(--cm-ink-3)",
            }}
          >
            {hintText || "Point at the tube barcode"}
          </p>
        )}
      </>
    </Modal>
  );
}