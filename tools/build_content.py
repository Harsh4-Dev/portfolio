"""
build_content.py — converts content.xlsx into site/content.json.

Pure standard library (zipfile + xml), so it runs anywhere Python runs — including the
GitHub Actions runner — with no pip install.

    python tools/build_content.py                 # content.xlsx -> site/content.json
    python tools/build_content.py in.xlsx out.json

Also importable:  from build_content import build, validate
"""
from __future__ import annotations

import datetime as _dt
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_XLSX = ROOT / "content.xlsx"
DEFAULT_JSON = ROOT / "site" / "content.json"

LAYOUTS = {"timeline", "cards", "tags", "stats", "text", "list", "gallery", "table", "contact"}
SHAPES = {"neuron", "perceptron", "mlp", "cnn", "deep", "transformer", "constellation"}
META_SHEETS = {"settings", "sections", "journey", "links"}
TRUE_WORDS = {"yes", "y", "true", "1", "x", "on"}

# ------------------------------------------------------------------ minimal xlsx reader


def _strip(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def _col_index(ref: str) -> int:
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _date_styles(z: zipfile.ZipFile) -> set[int]:
    """Return the set of cellXfs indexes whose number format is a date."""
    try:
        root = ET.fromstring(z.read("xl/styles.xml"))
    except KeyError:
        return set()
    custom: dict[int, str] = {}
    for nf in root.iter():
        if _strip(nf.tag) == "numFmt":
            custom[int(nf.get("numFmtId"))] = nf.get("formatCode", "")
    builtin_dates = set(range(14, 23)) | set(range(45, 48)) | {27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 50, 51, 52, 53, 54, 55, 56, 57, 58}

    def is_date_fmt(fid: int) -> bool:
        if fid in builtin_dates:
            return True
        code = custom.get(fid, "")
        code = re.sub(r'"[^"]*"|\[[^\]]*\]', "", code)  # drop literals and [colour]
        return bool(re.search(r"[dmyhs]", code, re.I)) and not re.search(r"[#0?]", code)

    styles: set[int] = set()
    cellxfs = None
    for el in root.iter():
        if _strip(el.tag) == "cellXfs":
            cellxfs = el
            break
    if cellxfs is None:
        return styles
    for i, xf in enumerate(list(cellxfs)):
        fid = int(xf.get("numFmtId", "0"))
        if is_date_fmt(fid):
            styles.add(i)
    return styles


def _shared_strings(z: zipfile.ZipFile) -> list[str]:
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    out = []
    for si in root:
        if _strip(si.tag) != "si":
            continue
        out.append("".join(t.text or "" for t in si.iter() if _strip(t.tag) == "t"))
    return out


def _serial_to_date(v: float) -> str:
    base = _dt.datetime(1899, 12, 30)
    d = base + _dt.timedelta(days=float(v))
    if d.hour or d.minute or d.second:
        return d.strftime("%Y-%m-%d %H:%M")
    return d.strftime("%Y-%m-%d")


def _cell_value(c, shared, date_styles):
    t = c.get("t")
    s = c.get("s")
    v = None
    is_el = None
    for ch in c:
        tag = _strip(ch.tag)
        if tag == "v":
            v = ch.text
        elif tag == "is":
            is_el = ch
    if t == "s":
        return shared[int(v)] if v is not None else ""
    if t == "inlineStr":
        return "".join(x.text or "" for x in is_el.iter() if _strip(x.tag) == "t") if is_el is not None else ""
    if t == "b":
        return v == "1"
    if t in ("str", "e"):
        return v or ""
    if v is None:
        return ""
    try:
        num = float(v)
    except ValueError:
        return v
    if s is not None and int(s) in date_styles:
        return _serial_to_date(num)
    return int(num) if num.is_integer() else num


def read_workbook(path: Path) -> dict[str, list[list]]:
    """Return {sheet_name: [[cell, ...], ...]} for every sheet, in workbook order."""
    with zipfile.ZipFile(path) as z:
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {}
        for r in rels:
            tgt = r.get("Target", "")
            if tgt.startswith("/"):
                tgt = tgt[1:]
            elif not tgt.startswith("xl/"):
                tgt = "xl/" + tgt
            rid_to_target[r.get("Id")] = tgt
        shared = _shared_strings(z)
        date_styles = _date_styles(z)
        sheets: dict[str, list[list]] = {}
        for sh in wb.iter():
            if _strip(sh.tag) != "sheet":
                continue
            name = sh.get("name")
            rid = next(v for k, v in sh.attrib.items() if _strip(k) == "id")
            target = rid_to_target[rid]
            root = ET.fromstring(z.read(target))
            rows: list[list] = []
            for row in root.iter():
                if _strip(row.tag) != "row":
                    continue
                cells: list = []
                for c in row:
                    if _strip(c.tag) != "c":
                        continue
                    ref = c.get("r")
                    idx = _col_index(ref) if ref else len(cells)
                    while len(cells) < idx:
                        cells.append("")
                    cells.append(_cell_value(c, shared, date_styles))
                rows.append(cells)
            sheets[name] = rows
    return sheets


# ------------------------------------------------------------------ table -> records


def _norm_key(k) -> str:
    return re.sub(r"[^a-z0-9]+", "_", str(k).strip().lower()).strip("_")


def _clean(v):
    if isinstance(v, str):
        return v.strip()
    return v


def records(rows: list[list]) -> list[dict]:
    """First non-empty row is the header; blank rows are skipped; blank cells are omitted."""
    rows = [r for r in rows]
    hdr_i = next((i for i, r in enumerate(rows) if any(str(c).strip() for c in r)), None)
    if hdr_i is None:
        return []
    header = [_norm_key(h) for h in rows[hdr_i]]
    out = []
    for r in rows[hdr_i + 1:]:
        rec = {}
        for i, cell in enumerate(r):
            if i >= len(header) or not header[i]:
                continue
            val = _clean(cell)
            if val == "" or val is None:
                continue
            rec[header[i]] = val
        if rec:
            out.append(rec)
    return out


def truthy(v) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    return str(v).strip().lower() in TRUE_WORDS


def _sort(items: list[dict]) -> list[dict]:
    def key(pair):
        i, it = pair
        o = it.get("order")
        try:
            return (0, float(o), i)
        except (TypeError, ValueError):
            return (1, 0.0, i)
    return [it for _, it in sorted(enumerate(items), key=key)]


# ------------------------------------------------------------------ build


def build(xlsx: Path = DEFAULT_XLSX) -> dict:
    sheets = read_workbook(xlsx)
    by_lower = {name.lower(): name for name in sheets}

    def table(name: str) -> list[dict]:
        real = by_lower.get(name.lower())
        return records(sheets[real]) if real else []

    settings = {}
    for r in table("settings"):
        k = r.get("key")
        if k:
            settings[_norm_key(k)] = r.get("value", "")

    journey_rows = _sort(table("journey"))
    journey = []
    for j in journey_rows:
        jid = _norm_key(j.get("id") or j.get("shape") or j.get("title", ""))
        if not jid:
            continue
        journey.append({
            "id": jid,
            "year": str(j.get("year", "")),
            "title": str(j.get("title", "")),
            "insight": str(j.get("insight", "")),
            "shape": str(j.get("shape", jid)).strip().lower(),
            "color": str(j.get("color", "accent")),
        })

    links = []
    for l in _sort(table("links")):
        if l.get("url"):
            links.append({"label": str(l.get("label", l["url"])), "url": str(l["url"]),
                          "icon": str(l.get("icon", "")), "show_in": str(l.get("show_in", "all")).lower()})

    registered = {}
    for s in table("sections"):
        sid = str(s.get("id", "")).strip()
        if sid:
            registered[sid.lower()] = s

    data_sheets = [n for n in sheets if not n.startswith("_") and n.lower() not in META_SHEETS]
    sections = []
    data = {}
    for pos, name in enumerate(data_sheets):
        reg = registered.get(name.lower(), {})
        items = [it for it in _sort(records(sheets[name])) if not truthy(it.get("hidden", False))]
        visible = reg.get("visible", "yes")
        sec = {
            "id": name,
            "title": str(reg.get("title", name)),
            "eyebrow": str(reg.get("eyebrow", "")),
            "intro": str(reg.get("intro", "")),
            "layout": str(reg.get("layout", "cards")).strip().lower(),
            "order": reg.get("order", 1000 + pos),
            "era": str(reg.get("era", "")).strip().lower(),
            "doodle": str(reg.get("doodle", "")).strip().lower(),
            "columns": reg.get("columns", ""),
            "visible": truthy(visible) if visible != "" else True,
            "cta_label": str(reg.get("cta_label", "")),
            "cta_link": str(reg.get("cta_link", "")),
            "count": len(items),
        }
        for k, v in reg.items():  # keep any extra section-level columns too
            if k not in sec and k not in ("id",):
                sec[k] = v
        sections.append(sec)
        data[name] = items

    # sections listed in the Sections sheet but without a data sheet still exist (e.g. text-only intro)
    for lname, reg in registered.items():
        if lname not in {n.lower() for n in data_sheets}:
            sid = str(reg.get("id"))
            sections.append({
                "id": sid, "title": str(reg.get("title", sid)), "eyebrow": str(reg.get("eyebrow", "")),
                "intro": str(reg.get("intro", "")), "layout": str(reg.get("layout", "text")).lower(),
                "order": reg.get("order", 9999), "era": str(reg.get("era", "")).lower(),
                "doodle": str(reg.get("doodle", "")).lower(), "columns": reg.get("columns", ""),
                "visible": truthy(reg.get("visible", "yes")), "cta_label": str(reg.get("cta_label", "")),
                "cta_link": str(reg.get("cta_link", "")), "count": 0,
            })
            data[sid] = []

    sections = _sort(sections)

    return {
        "generated_at": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": xlsx.name,
        "settings": settings,
        "journey": journey,
        "links": links,
        "sections": sections,
        "data": data,
    }


def validate(content: dict, site_dir: Path = ROOT / "site") -> list[str]:
    warns: list[str] = []
    eras = {j["id"] for j in content["journey"]}
    for j in content["journey"]:
        if j["shape"] not in SHAPES:
            warns.append(f"Journey '{j['id']}': unknown shape '{j['shape']}' (use one of {', '.join(sorted(SHAPES))})")
    for s in content["sections"]:
        if s["layout"] not in LAYOUTS:
            warns.append(f"Section '{s['id']}': unknown layout '{s['layout']}' - falling back to cards")
        if s["era"] and s["era"] not in eras:
            warns.append(f"Section '{s['id']}': era '{s['era']}' is not in the Journey sheet")
        if s["count"] == 0 and s["layout"] not in ("text",):
            warns.append(f"Section '{s['id']}' has no items")
    img_dir = site_dir / "assets" / "img"
    for sid, items in content["data"].items():
        for i, it in enumerate(items, start=2):
            for key in ("image", "images"):
                for img in str(it.get(key, "")).split(";"):
                    img = img.strip()
                    if img and not img.startswith(("http://", "https://", "data:")) and not (img_dir / img).exists():
                        warns.append(f"{sid} row {i}: image '{img}' not found in site/assets/img/")
    av = content["settings"].get("avatar", "")
    if av and not av.startswith("http") and not (img_dir / av).exists():
        warns.append(f"Settings avatar '{av}' not found in site/assets/img/")
    return warns


def write(content: dict, out: Path = DEFAULT_JSON) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(content, indent=2, ensure_ascii=False), encoding="utf-8")
    return out


def main(argv: list[str]) -> int:
    xlsx = Path(argv[1]) if len(argv) > 1 else DEFAULT_XLSX
    out = Path(argv[2]) if len(argv) > 2 else DEFAULT_JSON
    if not xlsx.exists():
        print(f"error: {xlsx} not found", file=sys.stderr)
        return 1
    content = build(xlsx)
    write(content, out)
    n_items = sum(len(v) for v in content["data"].values())
    print(f"wrote {out}  ({len(content['sections'])} sections, {n_items} items, {len(content['journey'])} eras)")
    for w in validate(content, out.parent):
        print("  warning:", w)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
