"""
Partner MOUs — the original .docx agreements, rendered word for word.

The files in backend/legal_docs/mous/ are the legal originals a partner is
asked to accept. They live inside backend/ because that is the Docker build
context: the old loader read a repo-root mous/ folder that was gitignored and
outside the image, found nothing in production, and every partner was shown a
paraphrased stub instead of the agreement they were bound by.

Everything a partner sees — the acceptance page, the emailed copy, the
dashboard viewer and the download — is derived from those bytes. Nothing is
summarised. Word stores list numbers ("1.", "a.") in numbering.xml rather than
in the text, so they are recomputed here the way Word does; a plain text dump
drops every clause number. render_document() refuses to return a rendering
whose text differs from the document's own text by a single character.
"""
from __future__ import annotations

import hashlib
import html
import io
import re
import zipfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional
import xml.etree.ElementTree as ET

MOU_DIR = Path(__file__).resolve().parents[2] / "legal_docs" / "mous"


class MouDocumentError(RuntimeError):
    """An original agreement is missing or could not be rendered faithfully."""


@dataclass(frozen=True)
class MouDocument:
    key: str        # stable id, persisted in acceptance records — never rename
    label: str      # short tab label; the document's own title is inside it
    filename: str


DOCUMENTS: dict[str, MouDocument] = {d.key: d for d in (
    MouDocument("doctor_onboarding", "Onboarding Agreement", "DOCTOR.docx"),
    MouDocument("doctor_terms", "Terms & Conditions", "CALLMEDEX_Doctors_Terms_and_Conditions_Modified.docx"),
    MouDocument("nurse_onboarding", "Onboarding Agreement", "Nursing.docx"),
    MouDocument("nursing_home_services_terms", "Nursing Home Services Terms", "CALLMEDEX_Nursing_Home_Services_Terms.docx"),
    MouDocument("physiotherapist_onboarding", "Onboarding Agreement", "PHYSIOTHERAPIST.docx"),
    MouDocument("physiotherapy_terms", "Physiotherapy Services Terms", "CALLMEDEX_Physiotherapy_Centers_and_Home_Services_Terms.docx"),
    MouDocument("dietitian_terms", "Dietician Terms & Conditions", "Dietician Terms & Conditions.docx"),
    MouDocument("dietetic_services_terms", "Dietetic Services Terms & Conditions", "CALLMEDEX_Dietetic_Services_Terms_and_Conditions.docx"),
    MouDocument("dental_clinics_terms", "Dental Clinics Terms & Conditions", "CALLMEDEX_Dental_Clinics_Terms_and_Conditions.docx"),
    MouDocument("phlebotomist_full_time", "Full-Time Phlebotomist Terms", "FULL TIME PHLEBO (1).docx"),
    MouDocument("phlebotomist_part_time", "Part-Time Phlebotomist Terms", "PART TIME PHLEBO (1).docx"),
    MouDocument("diagnostic_services_agreement", "Diagnostic Services Agreement", "CALL MEDEX Diagnostic Services Agreement.docx"),
    MouDocument("diagnostic_services_terms", "Diagnostic Services Terms", "Diagnostic Center MOUs.docx"),
    MouDocument("ecg_xray_pft_audiometry_terms", "ECG, X-Ray, PFT & Audiometry Terms", "ECG X RAY MOU.docx"),
    MouDocument("logistic_person_terms", "Logistic Person Terms", "LOGISTIC PERSON.docx"),
)}

_ROLE_KEYS: dict[str, tuple[str, ...]] = {
    "doctor": ("doctor_onboarding", "doctor_terms"),
    "nurse": ("nurse_onboarding", "nursing_home_services_terms"),
    "physiotherapist": ("physiotherapist_onboarding", "physiotherapy_terms"),
    "dietitian": ("dietitian_terms", "dietetic_services_terms"),
    "dentist": ("dental_clinics_terms",),
    "staff": ("logistic_person_terms",),
}
_DIAGNOSTIC_KEYS = ("diagnostic_services_agreement", "diagnostic_services_terms", "ecg_xray_pft_audiometry_terms")
_ORGANIZATION_KEYS: dict[str, tuple[str, ...]] = {
    "dental_clinic": ("dental_clinics_terms",),
    "physiotherapy_center": ("physiotherapy_terms",),
    "nursing_home": ("nursing_home_services_terms",),
}


def document_keys_for(role: str, *, phleb_type: Optional[str] = None,
                      organization_type: Optional[str] = None) -> tuple[str, ...]:
    """The originals a partner of this role/subtype must accept. Empty when no
    original exists for the role (pharmacy, ambulance)."""
    role = (role or "").strip().lower()
    if role == "phlebotomist":
        # Signup defaults an unset phleb_type to full_time (auth._build_profile_data).
        part_time = (phleb_type or "").strip().lower() == "part_time"
        return ("phlebotomist_part_time",) if part_time else ("phlebotomist_full_time",)
    if role == "organization":
        # Clinic, polyclinic, hospital, diagnostic centre — and the signup
        # default of "hospital" — all take the diagnostic agreements.
        return _ORGANIZATION_KEYS.get((organization_type or "").strip().lower(), _DIAGNOSTIC_KEYS)
    return _ROLE_KEYS.get(role, ())


# ─── DOCX → HTML / text ────────────────────────────────────────────────────

_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_O = "{urn:schemas-microsoft-com:office:office}"
_SKIP = {_W + "del", _W + "moveFrom", _W + "pPr", _W + "rPr", _W + "instrText", _W + "delText"}
# Symbol / Wingdings bullet glyphs live in the private-use area.
_BULLET_GLYPHS = {"": "•", "": "▪", "": "➢", "": "✓",
                  "": "❖", "": "■", "": "◆", "": "➔"}
_MARKER_EM = 1.6  # width reserved for a list marker


def _val(el, tag, default=None):
    node = el.find(_W + tag) if el is not None else None
    return default if node is None else node.get(_W + "val", default)


def _toggle(rpr, tag) -> Optional[bool]:
    node = rpr.find(_W + tag) if rpr is not None else None
    if node is None:
        return None
    return node.get(_W + "val", "true").lower() not in ("0", "false", "off", "none")


def _underline(rpr) -> Optional[bool]:
    node = rpr.find(_W + "u") if rpr is not None else None
    return None if node is None else node.get(_W + "val", "single") != "none"


def _roman(n: int) -> str:
    out = ""
    for value, sym in ((1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"),
                       (50, "l"), (40, "xl"), (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")):
        while n >= value:
            out, n = out + sym, n - value
    return out


def _letters(n: int) -> str:
    # Word repeats the letter past z: a..z, aa..zz, aaa..
    return chr(ord("a") + (n - 1) % 26) * ((n - 1) // 26 + 1)


def _format_number(n: int, fmt: str) -> str:
    return {
        "lowerLetter": _letters(n), "upperLetter": _letters(n).upper(),
        "lowerRoman": _roman(n), "upperRoman": _roman(n).upper(),
        "decimalZero": f"{n:02d}", "none": "",
    }.get(fmt, str(n))


class _Docx:
    def __init__(self, data: bytes):
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            parts = {n: z.read(n) for n in z.namelist() if n.startswith("word/") and n.endswith(".xml")}
        self.body = ET.fromstring(parts["word/document.xml"]).find(_W + "body")
        self.styles = self._parse_styles(parts.get("word/styles.xml"))
        self.abstract, self.nums = self._parse_numbering(parts.get("word/numbering.xml"))
        self.counters: dict[str, list[Optional[int]]] = {}
        self.started_nums: set[str] = set()
        # Headers, footers and notes are not placed in the rendering, so a
        # document that uses them for text must fail loudly, not lose it.
        for name, xml in parts.items():
            if re.match(r"word/(header|footer|footnotes|endnotes)\d*\.xml$", name):
                root = ET.fromstring(xml)
                scopes = [n for n in root if n.get(_W + "type") in (None, "normal")] if "notes" in name else [root]
                if any((t.text or "").strip() for s in scopes for t in s.iter(_W + "t")):
                    raise MouDocumentError(f"{name} carries text that is not rendered")

    @staticmethod
    def _parse_styles(xml):
        styles = {}
        if xml is None:
            return styles
        for s in ET.fromstring(xml).findall(_W + "style"):
            ppr, rpr = s.find(_W + "pPr"), s.find(_W + "rPr")
            numpr = ppr.find(_W + "numPr") if ppr is not None else None
            styles[s.get(_W + "styleId")] = {
                "name": (_val(s, "name") or "").lower(),
                "based_on": _val(s, "basedOn"),
                "bold": _toggle(rpr, "b"), "italic": _toggle(rpr, "i"), "underline": _underline(rpr),
                "num_id": _val(numpr, "numId"), "ilvl": _val(numpr, "ilvl"),
                "jc": _val(ppr, "jc"),
            }
        return styles

    @staticmethod
    def _parse_numbering(xml):
        abstract, nums = {}, {}
        if xml is None:
            return abstract, nums
        root = ET.fromstring(xml)
        for a in root.findall(_W + "abstractNum"):
            abstract[a.get(_W + "abstractNumId")] = {
                int(lvl.get(_W + "ilvl")): (_val(lvl, "numFmt", "decimal"), _val(lvl, "lvlText", ""), int(_val(lvl, "start", "1")))
                for lvl in a.findall(_W + "lvl")
            }
        for n in root.findall(_W + "num"):
            overrides = {int(o.get(_W + "ilvl")): int(_val(o, "startOverride"))
                         for o in n.findall(_W + "lvlOverride") if _val(o, "startOverride") is not None}
            nums[n.get(_W + "numId")] = (_val(n, "abstractNumId"), overrides)
        return abstract, nums

    def style_prop(self, style_id, prop):
        seen = set()
        while style_id and style_id in self.styles and style_id not in seen:
            seen.add(style_id)
            value = self.styles[style_id][prop]
            if value is not None:
                return value
            style_id = self.styles[style_id]["based_on"]
        return None

    def marker(self, num_id: Optional[str], ilvl: int) -> Optional[str]:
        """The list marker Word would draw for this paragraph, advancing counters."""
        if not num_id or num_id == "0" or num_id not in self.nums:
            return None
        abs_id, overrides = self.nums[num_id]
        levels = self.abstract.get(abs_id)
        if not levels:
            return None
        counters = self.counters.setdefault(abs_id, [None] * 9)
        if num_id not in self.started_nums:
            self.started_nums.add(num_id)
            for lvl, start in overrides.items():
                counters[lvl] = start - 1
        fmt, text, start = levels.get(ilvl, levels.get(0))
        counters[ilvl] = (start - 1 if counters[ilvl] is None else counters[ilvl]) + 1
        for deeper in range(ilvl + 1, 9):
            counters[deeper] = None  # a new parent item restarts its sub-levels
        if fmt == "bullet":
            return "".join(_BULLET_GLYPHS.get(ch, "•" if ord(ch) >= 0xF000 else ch) for ch in text) or "•"

        def level_value(m):
            lvl = int(m.group(1)) - 1
            lfmt, _, lstart = levels.get(lvl, (fmt, "", 1))
            return _format_number(counters[lvl] if counters[lvl] is not None else lstart, lfmt)

        return re.sub(r"%(\d)", level_value, text)


def _paragraph(doc: _Docx, p) -> dict:
    ppr = p.find(_W + "pPr")
    style = _val(ppr, "pStyle") or "Normal"
    numpr = ppr.find(_W + "numPr") if ppr is not None else None
    num_id = _val(numpr, "numId") if numpr is not None else doc.style_prop(style, "num_id")
    ilvl = int((_val(numpr, "ilvl") if numpr is not None else doc.style_prop(style, "ilvl")) or 0)
    base = {k: bool(doc.style_prop(style, k)) for k in ("bold", "italic", "underline")}
    runs: list[tuple[str, tuple[bool, bool, bool]]] = []
    hr = False

    def walk(el):
        nonlocal hr
        for child in el:
            if child.tag in _SKIP:
                continue
            if child.tag != _W + "r":
                walk(child)
                continue
            rpr = child.find(_W + "rPr")
            fmt = tuple(base[k] if v is None else v for k, v in (
                ("bold", _toggle(rpr, "b")), ("italic", _toggle(rpr, "i")), ("underline", _underline(rpr))))
            for node in child.iter():
                tag = node.tag
                if tag == _W + "t":
                    runs.append((node.text or "", fmt))
                elif tag == _W + "tab":
                    runs.append(("\t", fmt))
                elif tag in (_W + "br", _W + "cr"):
                    runs.append(("\n", fmt))
                elif tag == _W + "noBreakHyphen":
                    runs.append(("-", fmt))
                elif tag == _W + "sym":
                    ch = chr(int(node.get(_W + "char"), 16))
                    runs.append((_BULLET_GLYPHS.get(ch, ch), fmt))
                elif node.get(_O + "hr") in ("t", "true"):
                    hr = True

    walk(p)
    name = (doc.styles.get(style) or {}).get("name", "")
    m = re.match(r"heading (\d)$", name)
    return {
        "type": "p", "runs": runs, "hr": hr, "ilvl": ilvl,
        "heading": int(m.group(1)) if m else (1 if name == "title" else None),
        "marker": doc.marker(num_id, ilvl),
        "jc": _val(ppr, "jc") or doc.style_prop(style, "jc"),
    }


_TRANSPARENT = {_W + t for t in ("sdt", "sdtContent", "customXml", "ins", "moveTo", "smartTag")}


def _blocks(doc: _Docx, container) -> list:
    out = []
    for el in container:
        if el.tag == _W + "p":
            out.append(_paragraph(doc, el))
        elif el.tag == _W + "tbl":
            rows = []
            for tr in el.iter(_W + "tr"):
                cells = []
                for tc in tr.findall(_W + "tc"):
                    tcpr = tc.find(_W + "tcPr")
                    vmerge = tcpr.find(_W + "vMerge") if tcpr is not None else None
                    cells.append({
                        "span": int(_val(tcpr, "gridSpan", "1")),
                        "merged": vmerge is not None and vmerge.get(_W + "val", "continue") == "continue",
                        "blocks": _blocks(doc, tc),
                    })
                rows.append(cells)
            out.append({"type": "table", "rows": rows})
        elif el.tag in _TRANSPARENT:
            out.extend(_blocks(doc, el))
    return out


def _raw_text(el) -> str:
    """Every w:t under the element, skipping deleted revisions — the ground truth."""
    if el.tag in (_W + "del", _W + "moveFrom"):
        return ""
    own = (el.text or "") if el.tag == _W + "t" else ""
    return own + "".join(_raw_text(c) for c in el)


def _paragraph_text(block) -> str:
    return "".join(t for t, _ in block["runs"])


def _runs_html(runs) -> str:
    merged: list[list] = []
    for text, fmt in runs:
        if merged and merged[-1][1] == fmt:
            merged[-1][0] += text
        else:
            merged.append([text, fmt])
    out = []
    for text, (bold, italic, underline) in merged:
        piece = html.escape(text).replace("\t", "&emsp;").replace("\n", "<br>")
        if underline:
            piece = f"<u>{piece}</u>"
        if italic:
            piece = f"<em>{piece}</em>"
        if bold:
            piece = f"<strong>{piece}</strong>"
        out.append(piece)
    return "".join(out)


_HEADING_SIZE = {1: "1.3em", 2: "1.15em", 3: "1.05em"}
_ALIGN = {"center": "center", "right": "right", "end": "right", "both": "justify"}
_CELL = "border:1px solid #9ca3af;padding:5px 8px;vertical-align:top"


def _block_html(block, in_cell: bool = False) -> str:
    if block["type"] == "table":
        row_chunks = []
        for cells in block["rows"]:
            cell_chunks = []
            for c in cells:
                colspan = f' colspan="{c["span"]}"' if c["span"] > 1 else ""
                inner = "" if c["merged"] else "".join(_block_html(b, True) for b in c["blocks"])
                cell_chunks.append(f'<td{colspan} style="{_CELL}">{inner}</td>')
            row_chunks.append(f"<tr>{''.join(cell_chunks)}</tr>")
        rows = "".join(row_chunks)
        return ('<div style="overflow-x:auto;margin:8px 0 14px">'
                f'<table style="border-collapse:collapse;width:100%;font-size:0.92em">{rows}</table></div>')

    out = '<hr style="border:0;border-top:1px solid #9ca3af;margin:14px 0">' if block["hr"] else ""
    body, marker = _runs_html(block["runs"]), block["marker"]
    if marker is None and not _paragraph_text(block).strip():
        # An empty paragraph is vertical space in Word; keep it as space.
        return out or f'<p style="margin:0;line-height:{"1em" if in_cell else "0.8em"}">&nbsp;</p>'

    align = _ALIGN.get(block["jc"] or "")
    style = f"text-align:{align};" if align else ""
    heading = block["heading"] if not in_cell else None
    if in_cell:
        style += "margin:0;"
    elif heading:
        style += f"margin:16px 0 6px;font-size:{_HEADING_SIZE.get(heading, '1em')};font-weight:700;line-height:1.35;"
    else:
        style += "margin:0 0 8px;"
    if marker is not None:
        style += f"padding-left:{_MARKER_EM * (block['ilvl'] + 1):g}em;text-indent:-{_MARKER_EM:g}em;"
        body = (f'<span data-mou-marker="" style="display:inline-block;min-width:{_MARKER_EM:g}em;text-indent:0">'
                f"{html.escape(marker)}</span>{body}")
    tag = f"h{min(heading, 4)}" if heading else "p"
    return f'{out}<{tag} style="{style}">{body}</{tag}>'


def _block_text(block) -> str:
    if block["type"] == "table":
        return "\n".join(
            " | ".join(" ".join(_block_text(b) for b in c["blocks"]).strip() for c in cells)
            for cells in block["rows"])
    text = _paragraph_text(block)
    if block["marker"]:
        text = "    " * block["ilvl"] + block["marker"] + " " + text
    return text


def _is_blank(block) -> bool:
    return block["type"] == "p" and not block["hr"] and block["marker"] is None and not _paragraph_text(block).strip()


def _visible_text(markup: str) -> str:
    """What a reader of the HTML sees, minus the generated list markers."""
    markup = re.sub(r"<span data-mou-marker[^>]*>.*?</span>", "", markup)
    return html.unescape(re.sub(r"<[^>]+>", "", markup))


_WHITESPACE = re.compile(r"\s+")


def render_document(key: str) -> dict:
    """Render one original agreement: key, label, filename, title, sha256, html, text.
    Returns a fresh dict; the rendering itself is cached per process (the files
    ship inside the image, so they cannot change under a running worker)."""
    return dict(_render(key))


@lru_cache(maxsize=None)
def _render(key: str) -> dict:
    meta = DOCUMENTS.get(key)
    if meta is None:
        raise MouDocumentError(f"Unknown MOU document key: {key}")
    path = MOU_DIR / meta.filename
    try:
        data = path.read_bytes()
    except OSError as e:
        raise MouDocumentError(f"Original MOU file missing: {path}") from e

    doc = _Docx(data)
    blocks = _blocks(doc, doc.body)
    while blocks and _is_blank(blocks[0]):
        blocks.pop(0)
    while blocks and _is_blank(blocks[-1]):
        blocks.pop()

    markup = ('<div class="cm-mou-doc" style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;'
              'line-height:1.6;color:#111827;text-align:left;overflow-wrap:break-word">'
              + "".join(_block_html(b) for b in blocks) + "</div>")

    # Faithfulness gate: the HTML must carry exactly the document's own text.
    if _WHITESPACE.sub("", _visible_text(markup)) != _WHITESPACE.sub("", _raw_text(doc.body)):
        raise MouDocumentError(f"Rendering of {meta.filename} does not match its source text")

    text = re.sub(r"\n{3,}", "\n\n", "\n".join(_block_text(b) for b in blocks)).strip()
    title = next((line for b in blocks if b["type"] == "p"
                  for line in [_paragraph_text(b).strip().split("\n")[0].strip()] if line), meta.label)
    return {
        "key": meta.key,
        "label": meta.label,
        "filename": meta.filename,
        "title": title,
        "sha256": hashlib.sha256(data).hexdigest(),
        "html": markup,
        "text": text,
    }


def original_file(key: str) -> tuple[bytes, str]:
    """The untouched .docx bytes and filename, for download and email attachment."""
    meta = DOCUMENTS.get(key)
    if meta is None:
        raise MouDocumentError(f"Unknown MOU document key: {key}")
    try:
        return (MOU_DIR / meta.filename).read_bytes(), meta.filename
    except OSError as e:
        raise MouDocumentError(f"Original MOU file missing: {meta.filename}") from e


def documents_for(role: str, *, phleb_type: Optional[str] = None,
                  organization_type: Optional[str] = None) -> list[dict]:
    keys = document_keys_for(role, phleb_type=phleb_type, organization_type=organization_type)
    return [render_document(k) for k in keys]
