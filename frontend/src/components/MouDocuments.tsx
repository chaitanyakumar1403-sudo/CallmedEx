"use client";

import { useState, type UIEvent } from "react";
import { Download, AlertTriangle, CheckCircle2 } from "@/components/ui/icons";

/**
 * A partner's original MOU documents, rendered word for word.
 *
 * `html` is produced by the backend from the signed .docx (app/services/
 * mou_loader.py): every piece of document text is HTML-escaped there and the
 * only markup is the renderer's own, so it is safe to inject. The download is
 * the untouched .docx, not a re-export.
 */
export interface MouDocument {
  key: string;
  label: string;
  filename: string;
  title: string;
  sha256: string;
  html: string;
  text: string;
  /** Dashboard only: whether this file is byte-identical to the one accepted. */
  matches_accepted_version?: boolean | null;
}

export async function downloadMouOriginal(url: string, filename: string, bearer?: string | null) {
  const res = await fetch(url, { headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

interface MouDocumentsProps {
  documents: MouDocument[];
  downloadUrl: (doc: MouDocument) => string;
  bearer?: string | null;
  paperMaxHeight?: string;
  onPaperScroll?: (e: UIEvent<HTMLDivElement>) => void;
  paperRef?: (node: HTMLDivElement | null) => void;
}

export default function MouDocuments({
  documents, downloadUrl, bearer, paperMaxHeight = "60vh", onPaperScroll, paperRef,
}: MouDocumentsProps) {
  const [active, setActive] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (documents.length === 0) return null;
  const doc = documents[Math.min(active, documents.length - 1)];

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadMouOriginal(downloadUrl(doc), doc.filename, bearer);
    } catch {
      setDownloadError("Could not download the original document. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="cm-mou-docs">
      {documents.length > 1 && (
        <div className="cm-mou-tabs" role="tablist" aria-label="Agreement documents">
          {documents.map((d, i) => (
            <button
              key={d.key}
              type="button"
              role="tab"
              aria-selected={d.key === doc.key}
              className={`cm-mou-tab ${d.key === doc.key ? "cm-mou-tab--active" : ""}`}
              onClick={() => { setActive(i); setDownloadError(null); }}
            >
              {i + 1}. {d.label}
            </button>
          ))}
        </div>
      )}

      {/* key remounts per document so scroll position (and scroll-to-end checks) restart */}
      <div
        key={doc.key}
        ref={paperRef}
        onScroll={onPaperScroll}
        className="cm-mou-paper"
        style={{ maxHeight: paperMaxHeight }}
        role="document"
        aria-label={doc.title}
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />

      <div className="cm-mou-docmeta">
        <div className="cm-mou-docmeta__info">
          <span>Original document: <strong>{doc.filename}</strong></span>
          <span title={doc.sha256}>SHA-256 fingerprint: <code>{doc.sha256.slice(0, 16)}…</code></span>
          {doc.matches_accepted_version === true && (
            <span className="cm-mou-docmeta__ok"><CheckCircle2 size={13} /> Identical to the version you accepted</span>
          )}
          {doc.matches_accepted_version === false && (
            <span className="cm-mou-docmeta__warn"><AlertTriangle size={13} /> Updated since you accepted it</span>
          )}
        </div>
        <button type="button" className="cm-mou-tab cm-mou-docmeta__download" onClick={handleDownload} disabled={downloading}>
          <Download size={14} /> {downloading ? "Downloading…" : "Download original (.docx)"}
        </button>
      </div>
      {downloadError && <div className="cm-mou-docmeta__warn" role="alert">{downloadError}</div>}
    </div>
  );
}
