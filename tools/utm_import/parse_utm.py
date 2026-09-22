"""Parse FCIM UTM timetable PDFs into raw lesson records (JSON).

Each word is placed in the box formed by the nearest drawn border on each side;
words sharing a box form one cell. Header boxes give group columns, left time
boxes give day/slot rows, a half-height box is an odd/even-week lesson.
"""
import bisect
import json
import re
import sys
import unicodedata
from collections import defaultdict

import pdfplumber

GROUP_RE = re.compile(r"[A-Z]{1,4}-\d{3}")
TIME_RE = re.compile(r"(\d{1,2})[.:](\d{2})-(\d{1,2})[.:](\d{2})")
SKIP = ("individuale", "individual")


def clean(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    for a, b in (("ş", "ș"), ("ţ", "ț"), ("Ş", "Ș"), ("Ţ", "Ț")):
        s = s.replace(a, b)
    return re.sub(r"[-□]", "", s).strip()


class Borders:
    def __init__(self, page):
        self.v = defaultdict(list)  # x -> [(y0, y1)]
        self.h = defaultdict(list)  # y -> [(x0, x1)]
        # Borders are drawn as thin rects/lines; big filled rects are the grey
        # lecture backgrounds and must not split a cell.
        for r in list(page.rects) + list(page.lines):
            w, h = r["x1"] - r["x0"], r["bottom"] - r["top"]
            if w < 1.6 and h > 2:
                self.v[round((r["x0"] + r["x1"]) / 2, 1)].append((r["top"], r["bottom"]))
            elif h < 1.6 and w > 2:
                self.h[round((r["top"] + r["bottom"]) / 2, 1)].append((r["x0"], r["x1"]))
        self.vx = sorted(self.v)
        self.hy = sorted(self.h)

    @staticmethod
    def _covers(spans, p):
        return any(a - 0.8 <= p <= b + 0.8 for a, b in spans)

    def box(self, px, py):
        i = bisect.bisect_left(self.vx, px)
        left = next((x for x in reversed(self.vx[:i]) if self._covers(self.v[x], py)), None)
        right = next((x for x in self.vx[i:] if self._covers(self.v[x], py)), None)
        j = bisect.bisect_left(self.hy, py)
        top = next((y for y in reversed(self.hy[:j]) if self._covers(self.h[y], px)), None)
        bottom = next((y for y in self.hy[j:] if self._covers(self.h[y], px)), None)
        if None in (left, right, top, bottom):
            return None
        return (left, top, right, bottom)


def cells_of(page):
    page = page.dedupe_chars()
    b = Borders(page)
    cells = defaultdict(list)
    for w in page.extract_words(keep_blank_chars=False, use_text_flow=False, extra_attrs=["size"]):
        bx = b.box((w["x0"] + w["x1"]) / 2, (w["top"] + w["bottom"]) / 2)
        if bx:
            cells[bx].append(w)
    out = {}
    for bx in cells:
        try:
            txt = page.within_bbox(bx).extract_text(x_tolerance=1.5, y_tolerance=1.5) or ""
        except ValueError:
            txt = ""
        out[bx] = clean(txt)
    return out


def parse(path: str, year: int) -> dict:
    page = pdfplumber.open(path).pages[0]
    cells = cells_of(page)
    # rows: time boxes in the left-most column
    min_x = min(bx[0] for bx, s in cells.items() if TIME_RE.search(s))
    time_boxes = sorted(((bx, TIME_RE.search(s)) for bx, s in cells.items()
                         if TIME_RE.search(s) and bx[0] <= min_x + 2), key=lambda t: t[0][1])
    slot_keys, rows, day = [], [], -1
    for bx, m in time_boxes:
        key = f"{int(m.group(1)):02d}:{m.group(2)}-{int(m.group(3)):02d}:{m.group(4)}"
        if key not in slot_keys:
            slot_keys.append(key)
        idx = slot_keys.index(key)
        if not rows or idx <= rows[-1][3]:
            day += 1
        rows.append((bx[1], bx[3], day, idx))
    first_row_top = rows[0][0]
    # columns: header boxes holding group names
    cols = []
    for bx, s in cells.items():
        names = GROUP_RE.findall(s.replace(" ", ""))
        if names and bx[3] <= first_row_top + 1 and len(s.replace(" ", "").replace("\n", "")) <= len("".join(names)) + 2:
            cols.append((bx[0], bx[2], names))
    cols.sort()
    x_min, x_max = cols[0][0] - 1, cols[-1][1] + 1

    lessons = []
    for bx, s in cells.items():
        if not s or bx[1] < first_row_top - 1 or bx[0] < x_min or bx[2] > x_max:
            continue
        if any(k in s.lower() for k in SKIP):
            continue
        hit = [(r0, r1, d, sl) for r0, r1, d, sl in rows if min(r1, bx[3]) - max(r0, bx[1]) > 1]
        if not hit:
            continue
        r0, r1, d, sl = hit[0]
        span_rows = len(hit)
        h = r1 - r0
        if span_rows > 1 or bx[3] - bx[1] > 0.7 * h:
            parity = "all"
        else:
            parity = "odd" if (bx[1] + bx[3]) / 2 < r0 + h / 2 else "even"
        groups = [n for c0, c1, names in cols
                  if min(c1, bx[2]) - max(c0, bx[0]) > 0.5 * (c1 - c0) for n in names]
        if groups:
            lessons.append({"year": year, "text": s, "groups": groups, "day": d, "slot": sl,
                            "parity": parity, "rows": span_rows})
    return {"year": year, "slots": slot_keys, "days": day + 1,
            "groups": [n for *_, ns in cols for n in ns], "lessons": lessons}


if __name__ == "__main__":
    out = [parse(p, int(y)) for p, y in zip(sys.argv[1::2], sys.argv[2::2])]
    json.dump(out, open("raw.json", "w"), ensure_ascii=False, indent=1)
    for d in out:
        print(d["year"], "slots", d["slots"], "days", d["days"], "groups", len(d["groups"]),
              "lessons", len(d["lessons"]))
