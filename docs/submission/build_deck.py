"""Fill the official Hack2skill template for LoopClose. Usage: python build.py template.pptx out.pptx"""
import sys, copy
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
from pptx.oxml.ns import qn
from lxml import etree

TAUPE = RGBColor(0x80, 0x6B, 0x63)
SAND = RGBColor(0xE3, 0xDD, 0xD1)
TINT = RGBColor(0xF4, 0xF1, 0xEC)
INK = RGBColor(0x2E, 0x2A, 0x28)
GREY = RGBColor(0x59, 0x59, 0x59)
MUTED = RGBColor(0x7A, 0x74, 0x70)
TEAL = RGBColor(0x1E, 0x6B, 0x64)
TEAL_TINT = RGBColor(0xE3, 0xF0, 0xEE)
RUST = RGBColor(0xA8, 0x4E, 0x38)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
HEAD = "Arial"
BODY = "Calibri"

L, R = 0.45, 9.55
W = R - L

src, out = sys.argv[1], sys.argv[2]
prs = Presentation(src)
S = prs.slides


# ---------- helpers ----------
def _name(shape, name):
    shape.name = name
    return shape


def box(slide, x, y, w, h, fill=TINT, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.06, name="card"):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = radius
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid(); s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line; s.line.width = Pt(1)
    s.shadow.inherit = False
    s.text_frame.text = ""
    return _name(s, name)


def text(slide, x, y, w, h, paras, size=11, color=INK, font=BODY, align=PP_ALIGN.LEFT,
         anchor=MSO_ANCHOR.TOP, margin=0.0, space_after=0, name="text", line_spacing=None):
    """paras: list of paragraphs; each paragraph is str or list of (text, {bold,italic,color,size,font})."""
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    fill_tf(tb.text_frame, paras, size, color, font, align, anchor, margin, space_after, line_spacing)
    return _name(tb, name)


def fill_tf(tf, paras, size=11, color=INK, font=BODY, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
            margin=0.0, space_after=0, line_spacing=None):
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for side in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, side, Inches(margin))
    tf.text = ""
    for i, para in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if space_after:
            p.space_after = Pt(space_after)
        if line_spacing:
            p.line_spacing = line_spacing
        runs = [(para, {})] if isinstance(para, str) else para
        for t, o in runs:
            r = p.add_run(); r.text = t
            f = r.font
            f.size = Pt(o.get("size", size)); f.name = o.get("font", font)
            f.bold = o.get("bold", False); f.italic = o.get("italic", False)
            f.color.rgb = o.get("color", color)


def arrow(slide, x1, y1, x2, y2, color=TAUPE, width=1.5, name="arrow"):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    c.line.color.rgb = color; c.line.width = Pt(width)
    ln = c.line._get_or_add_ln()
    tail = etree.SubElement(ln, qn("a:tailEnd")); tail.set("type", "triangle"); tail.set("w", "med"); tail.set("len", "med")
    return _name(c, name)


def circle(slide, x, y, d, label, fill=TEAL, color=WHITE, size=12, name="badge"):
    s = box(slide, x, y, d, d, fill=fill, shape=MSO_SHAPE.OVAL, name=name)
    fill_tf(s.text_frame, [[(label, {"bold": True})]], size=size, color=color, font=HEAD,
            align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
    return s


def header_box(slide):
    for sh in slide.shapes:
        if sh.has_text_frame and sh.text_frame.text.strip() and sh.shape_type == 17:
            return sh
    raise RuntimeError("no header")


def set_header(slide, headline, move_top=False):
    """Keep the organiser's question (line 1); replace the guidance line with our one-line message."""
    hb = header_box(slide)
    if move_top:
        hb.left, hb.top = Emu(259175), Emu(861225)
    tf = hb.text_frame
    while len(tf.paragraphs) > 1:
        tf._txBody.remove(tf.paragraphs[-1]._p)
    p0 = tf.paragraphs[0]
    p = copy.deepcopy(p0._p); tf._txBody.append(p)
    p = tf.paragraphs[-1]
    for r in list(p.runs)[1:]:
        p._p.remove(r._r)
    r = p.runs[0]; r.text = headline
    r.font.size = Pt(17); r.font.bold = True; r.font.italic = False; r.font.color.rgb = INK; r.font.name = HEAD
    p.space_before = Pt(2)


def cell(c, txt, size=9, bold=False, color=INK, fill=None, font=BODY):
    c.text = ""
    fill_tf(c.text_frame, [[(txt, {"bold": bold})]], size=size, color=color, font=font)
    c.margin_left = c.margin_right = Inches(0.06); c.margin_top = c.margin_bottom = Inches(0.03)
    c.vertical_anchor = MSO_ANCHOR.MIDDLE
    if fill is not None:
        c.fill.solid(); c.fill.fore_color.rgb = fill


def table(slide, x, y, w, col_w, rows, size=9, row_h=0.3, header_fill=TAUPE, name="table"):
    gs = slide.shapes.add_table(len(rows), len(rows[0]), Inches(x), Inches(y), Inches(w), Inches(row_h * len(rows)))
    _name(gs, name)
    t = gs.table
    tblPr = t._tbl.tblPr
    sid = tblPr.find(qn("a:tableStyleId"))
    if sid is not None:
        sid.text = "{5940675A-B579-460E-94D1-54222C63F5DA}"  # No Style, Table Grid -> we colour ourselves
    t.first_row = True; t.horz_banding = False
    for i, cw in enumerate(col_w):
        t.columns[i].width = Inches(cw)
    for ri, row in enumerate(rows):
        t.rows[ri].height = Inches(row_h)
        for ci, val in enumerate(row):
            if ri == 0:
                cell(t.cell(ri, ci), val, size=size, bold=True, color=WHITE, fill=header_fill)
            else:
                bold = ci == 0
                color = INK
                if isinstance(val, tuple):
                    val, color = val
                cell(t.cell(ri, ci), val, size=size, bold=bold, color=color, fill=WHITE if ri % 2 else TINT)
    return t


# =====================================================================
# Slide 1 - cover
s = S[0]
tb = [sh for sh in s.shapes if sh.has_text_frame][0]
lab = {"color": GREY}
val = {"bold": True, "color": INK}
fill_tf(tb.text_frame, [
    [("Team Name: ", lab), ("Syed Naazim Hussain", val)],
    [("Team Size: ", lab), ("1", val)],
    [("Problem Statement: ", lab), ("Challenge 05, Population Health: Closing the Screening-to-Care Loop", val)],
    [("Solution: ", lab), ("LoopClose", {"bold": True, "color": TEAL}),
     (": every actionable screening result has a named owner until care is documented", {"color": INK})],
], size=16, font=HEAD, margin=0.1, space_after=4)

# =====================================================================
# Slide 2 - team table
s = S[1]
set_header(s, "Solo entry: one founder-developer building the whole platform")
gt = [sh for sh in s.shapes if sh.has_table][0]
t = gt.table
for r in list(t.rows)[2:]:
    t._tbl.remove(r._tr)
vals = ["1", "Syed Naazim Hussain", "India", "Founder & Developer", "Individual (independent)", "Confirmed: 18+"]
for ci, v in enumerate(vals):
    c = t.cell(1, ci)
    para = c.text_frame.paragraphs[0]
    if para.runs:
        para.runs[0].text = v
        for r in para.runs[1:]:
            para._p.remove(r._r)
    else:
        rr = para.add_run(); rr.text = v
        # copy header run formatting family/size
        hdr = t.cell(0, ci).text_frame.paragraphs[0].runs[0].font
        rr.font.size = hdr.size; rr.font.name = hdr.name
    para.runs[0].font.bold = ci == 1
for ci in range(6):
    hr = t.cell(0, ci).text_frame.paragraphs[0].runs
    for r in hr: r.font.bold = True

team_cards = [("Owns end to end", "Product, architecture, code, clinical-content curation and the Responsible-AI documentation"),
              ("Core expertise", "FHIR R4 / HL7 v2 interoperability, event-sourced workflow systems, LLM application safety"),
              ("Before a pilot", "Clinician advisor review of pathways, SLAs and templates; native-speaker review of Arabic, Urdu and Hindi")]
gap = 0.15; cw = (W - gap * 2) / 3
for i, (h, d) in enumerate(team_cards):
    x = L + i * (cw + gap)
    box(s, x, 3.35, cw, 1.95, fill=TINT, name=f"team card {i+1}")
    circle(s, x + 0.18, 3.52, 0.4, str(i + 1), size=12)
    text(s, x + 0.7, 3.55, cw - 0.85, 0.35, [[(h, {"bold": True})]], size=12, font=HEAD, anchor=MSO_ANCHOR.MIDDLE)
    text(s, x + 0.18, 4.1, cw - 0.36, 1.1, [d], size=10.5, color=GREY)

# =====================================================================
# Slide 3 - capability summary (text body must stay <= 1,000 characters)
s = S[2]
set_header(s, "Engineered, not prototyped: invariants, standards and governance from day one")
CAP = ("Solo founder-developer (India) building LoopClose end to end: product, architecture, code, clinical content "
       "curation and governance documentation. Background in full-stack engineering and health-data interoperability: "
       "FHIR R4 / HL7 v2, event-sourced systems, workflow engines and LLM application safety. LoopClose is engineered, "
       "not prototyped: a pure, unit-tested case state machine whose invariants (every open case has an accountable "
       "owner; closure only with evidence or an authorised human decision; AI may propose but never close, assign or "
       "escalate) are enforced in code; durable SLA timers; cross-organisation referral tracking per IHE 360X/BSeR; a "
       "FHIR-native projection on HAPI; template-bound, safety-graded multilingual patient messaging (ar/en/ur/hi); and "
       "a Responsible-AI dossier mapped clause-by-clause to the DoH RAI Standard (2025). Impact is quantified with a "
       "transparent simulation calibrated to Abu Dhabi's published 30.5% positive-FIT colonoscopy completion rate.")
assert len(CAP) <= 1000, len(CAP)
box(s, L, 1.85, 6.05, 3.45, fill=TINT, name="capability card")
text(s, L + 0.25, 2.0, 5.55, 3.2, [CAP], size=12, color=INK, line_spacing=1.08, name="capability summary")
stats = [("50", "automated tests passing (state machine, SLA, FHIR, API, analytics)"),
         ("8", "architecture decision records"),
         ("2", "screening programmes on one engine: colorectal FIT, breast BI-RADS")]
for i, (n, lbl) in enumerate(stats):
    y = 1.85 + i * 1.17
    box(s, 6.75, y, 2.8, 1.04, fill=WHITE, line=SAND, name=f"stat {i+1}")
    text(s, 6.9, y + 0.1, 0.85, 0.84, [[(n, {"bold": True})]], size=30, color=TEAL, font=HEAD, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 7.7, y + 0.1, 1.75, 0.84, [lbl], size=10, color=GREY, anchor=MSO_ANCHOR.MIDDLE)

# =====================================================================
# Slide 4 - architecture / workflow
s = S[3]
set_header(s, "One case engine, across organisations; AI proposes, humans decide")
top, hA = 1.85, 2.2
# sources
text(s, L, top - 0.02, 1.3, 0.2, [[("SOURCES", {"bold": True})]], size=8, color=MUTED)
for i, lbl in enumerate(["Lab / LIS", "HIE (Malaffi)", "EMR / PACS"]):
    b = box(s, L, top + 0.25 + i * 0.66, 1.3, 0.52, fill=SAND, name=f"source {lbl}")
    fill_tf(b.text_frame, [[(lbl, {"bold": True})]], size=10, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
arrow(s, L + 1.33, top + 1.18, 2.03, top + 1.18)
# intake
text(s, 2.05, top - 0.02, 1.4, 0.2, [[("INTAKE", {"bold": True})]], size=8, color=MUTED)
b = box(s, 2.05, top + 0.25, 1.4, 1.84, fill=WHITE, line=TAUPE, name="intake adapters")
fill_tf(b.text_frame, [[("Integration adapters", {"bold": True})], "FHIR R4 DiagnosticReport", "HL7 v2 ORU^R01",
                       [("Idempotent; FIT and BI-RADS classified; urgency tier set", {"color": GREY})]],
        size=9, margin=0.08, space_after=3, anchor=MSO_ANCHOR.MIDDLE)
arrow(s, 3.48, top + 1.18, 3.68, top + 1.18)
# core
text(s, 3.7, top - 0.02, 3.2, 0.2, [[("LOOPCLOSE CORE", {"bold": True})]], size=8, color=MUTED)
box(s, 3.7, top + 0.25, 3.2, 1.84, fill=TINT, line=TAUPE, name="core frame")
subs = [("Case state machine", "owner + closure invariants"), ("SLA & escalation", "durable timers, 70% warn"),
        ("Referral & consult", "360X / BSeR offer → accept"), ("Messaging", "approved templates, 4 languages")]
for i, (h, d) in enumerate(subs):
    x = 3.8 + (i % 2) * 1.52; y = top + 0.35 + (i // 2) * 0.62
    b = box(s, x, y, 1.45, 0.54, fill=WHITE, name=f"core {h}")
    fill_tf(b.text_frame, [[(h, {"bold": True})], [(d, {"color": GREY, "size": 8})]], size=9, margin=0.05,
            align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
b = box(s, 3.8, top + 1.6, 2.97, 0.4, fill=TEAL_TINT, line=TEAL, name="ai band")
fill_tf(b.text_frame, [[("AI (propose-only): ", {"bold": True, "color": TEAL}),
                        ("navigator · summariser · drop-off risk · safety grader", {"color": INK})]],
        size=8.5, margin=0.04, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
arrow(s, 6.93, top + 1.18, 7.13, top + 1.18)
# people
text(s, 7.15, top - 0.02, 2.4, 0.2, [[("PEOPLE WHO OWN EACH STEP", {"bold": True})]], size=8, color=MUTED)
for i, (h, d) in enumerate([("Patient", "chat / SMS, teach-back, ar·en·ur·hi"), ("Coordinator", "worklist: overdue, unassigned, at-risk"),
                             ("Clinician & scheduler", "consult inbox, referral accept/decline"), ("Programme manager", "funnel, SLA, IFHAS-style export")]):
    b = box(s, 7.15, top + 0.25 + i * 0.47, 2.4, 0.4, fill=WHITE, line=SAND, name=f"role {h}")
    fill_tf(b.text_frame, [[(h + "  ", {"bold": True}), (d, {"color": GREY, "size": 8})]], size=9, margin=0.07,
            anchor=MSO_ANCHOR.MIDDLE)
# data layer
b = box(s, 2.05, top + 2.22, 4.85, 0.36, fill=SAND, name="data layer")
fill_tf(b.text_frame, [[("Data: ", {"bold": True}), ("Postgres event log + outbox  →  HAPI FHIR R4 (Task, Report, Provenance)", {})]],
        size=8.5, margin=0.06, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
# lifecycle chips
text(s, L, 4.6, 7, 0.2, [[("CASE LIFECYCLE (COLORECTAL FIT; BREAST IS CONFIG, NOT CODE)", {"bold": True})]], size=8, color=MUTED)
steps = ["Result issued", "Notified", "Acknowledged", "Consult", "Referral", "Booked", "Colonoscopy", "Treatment / surveillance", "Closed with evidence"]
n = len(steps); gap = 0.1; cw = (W - gap * (n - 1)) / n
for i, st in enumerate(steps):
    x = L + i * (cw + gap)
    last = i == n - 1
    b = box(s, x, 4.83, cw, 0.5, fill=TEAL if last else WHITE, line=None if last else TAUPE, radius=0.3, name=f"step {i+1}")
    fill_tf(b.text_frame, [[(st, {"bold": last})]], size=8, color=WHITE if last else INK, margin=0.03,
            align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# =====================================================================
# Slide 5 - target users & outcome
s = S[4]
set_header(s, "Five roles share one loop, and each sees exactly the step they own")
users = [
    ("Patient", "Gets a result letter, unsure what it means or what to do next; anxious",
     "Plain-language explanation in their language, a teach-back check, a booked appointment"),
    ("Programme coordinator", "Chases cases by phone and spreadsheet; no view of who owns what",
     "One worklist: overdue, unassigned, rejected and at-risk cases, with SLA clocks"),
    ("PHC clinician", "Referrals disappear after sending; hand-offs lose context",
     "Consult inbox, AI-drafted hand-off summary to approve, referral status visible"),
    ("Specialist & scheduler", "Incomplete referrals, no-shows, no feedback loop",
     "Accept / decline / redirect, booking queue, no-show rebook with outreach"),
    ("Programme manager", "ADPHC / DoH cannot see where loops stall or who is accountable",
     "Funnel, time-to-care, drop-off reasons, IFHAS-style indicator export"),
]
gap = 0.14; cw = (W - gap * 4) / 5
for i, (role, pain, gain) in enumerate(users):
    x = L + i * (cw + gap)
    box(s, x, 1.85, cw, 2.62, fill=TINT, name=f"user {role}")
    text(s, x + 0.12, 1.95, cw - 0.24, 0.5, [[(role, {"bold": True})]], size=11.5, font=HEAD, anchor=MSO_ANCHOR.TOP)
    text(s, x + 0.12, 2.47, cw - 0.24, 0.2, [[("TODAY", {"bold": True})]], size=7.5, color=RUST)
    text(s, x + 0.12, 2.66, cw - 0.24, 0.78, [pain], size=9, color=GREY)
    text(s, x + 0.12, 3.45, cw - 0.24, 0.2, [[("WITH LOOPCLOSE", {"bold": True})]], size=7.5, color=TEAL)
    text(s, x + 0.12, 3.64, cw - 0.24, 0.8, [gain], size=9, color=INK)
b = box(s, L, 4.62, W, 0.7, fill=TEAL, name="outcome band")
fill_tf(b.text_frame, [[("Intended outcome: ", {"bold": True}),
                        ("every actionable result is communicated, understood, owned at each hand-off and closed only with documented evidence.  ", {}),
                        ("Hero metric: positive FIT → colonoscopy within 31 days.", {"bold": True})]],
        size=11, color=WHITE, margin=0.18, anchor=MSO_ANCHOR.MIDDLE)

# =====================================================================
# Slide 6 - success measures (simulation)
s = S[5]
set_header(s, "Hero metric: colonoscopy within 31 days, 8% → 40% (simulated)")
cd = CategoryChartData()
cd.categories = ["Acknowledged result", "Appointment booked", "Colonoscopy completed", "Completed within 31 days"]
cd.add_series("Today (baseline)", (0.74, 0.47, 0.38, 0.08))
cd.add_series("With LoopClose", (0.88, 0.70, 0.60, 0.40))
gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, Inches(L), Inches(1.8), Inches(5.5), Inches(3.05), cd)
_name(gf, "impact chart")
ch = gf.chart
ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.TOP; ch.legend.include_in_layout = False
ch.legend.font.size = Pt(9); ch.legend.font.color.rgb = GREY
ch.font.name = BODY
plot = ch.plots[0]; plot.gap_width = 55; plot.overlap = -5
plot.has_data_labels = True
dl = plot.data_labels; dl.number_format = '0%'; dl.number_format_is_linked = False
dl.font.size = Pt(9); dl.font.color.rgb = INK; dl.position = XL_LABEL_POSITION.OUTSIDE_END
for ser, col in zip(plot.series, (SAND, TEAL)):
    ser.format.fill.solid(); ser.format.fill.fore_color.rgb = col
ca = ch.category_axis; ca.reverse_order = True
ca.tick_labels.font.size = Pt(9); ca.tick_labels.font.color.rgb = GREY
ca.format.line.color.rgb = SAND; ca.has_major_gridlines = False
va = ch.value_axis; va.visible = False; va.has_major_gridlines = False
va.maximum_scale = 1.0; va.minimum_scale = 0
text(s, L, 4.9, 5.5, 0.45, [[("Simulation, not clinical evidence: ", {"bold": True}),
     ("300 positive FITs × 500 Monte-Carlo runs (medians). Baseline parameters from Abu Dhabi 2015–16 data; "
      "the model baseline (38%) sits above the observed 30.5%, so the uplift shown is conservative.", {})]],
     size=8, color=MUTED)
# right column
cards = [("45 → 26", "median days, result to colonoscopy"), ("187 → 119", "unresolved actionable results per 300 positives")]
for i, (big, lbl) in enumerate(cards):
    y = 1.85 + i * 1.0
    box(s, 6.2, y, 3.35, 0.88, fill=TINT, name=f"impact stat {i+1}")
    text(s, 6.35, y + 0.06, 3.1, 0.45, [[(big, {"bold": True})]], size=22, color=TEAL, font=HEAD)
    text(s, 6.35, y + 0.52, 3.1, 0.3, [lbl], size=9.5, color=GREY)
box(s, 6.2, 3.85, 3.35, 1.48, fill=WHITE, line=SAND, name="pilot measures")
text(s, 6.35, 3.92, 3.1, 1.36, [
    [("Measured live from the event log in a pilot", {"bold": True})],
    "Time to notification, acknowledgement, consult, confirmatory test and treatment",
    "Referral acceptance, appointment completion, no-shows",
    "Open results by age; drop-off reasons; teach-back pass rate; patient confidence (PREM)"],
    size=9, color=INK, space_after=3)

# =====================================================================
# Slide 7 - evidence
s = S[6]
set_header(s, "The gap is measured, in Abu Dhabi too; tooling makes fixes stick")
ev = [("30.5%", "of positive FITs in Abu Dhabi completed follow-up colonoscopy", "AHS clinics 2015–16, PMC8343888"),
      ("36.3%", "of non-completers were referred to GI but never attended", "same cohort, PMC8343888"),
      ("6.8–62%", "of lab results lack documented follow-up (radiology 1–36%)", "Joint Commission review"),
      ("<60%", "typical baseline loop closure; worst for colonoscopy", "AHRQ closed-loop learning lab")]
gap = 0.15; cw = (W - gap * 3) / 4
for i, (big, lbl, srcs) in enumerate(ev):
    x = L + i * (cw + gap)
    box(s, x, 1.85, cw, 1.75, fill=TINT, name=f"evidence {i+1}")
    text(s, x + 0.14, 1.93, cw - 0.28, 0.6, [[(big, {"bold": True})]], size=28, color=RUST if i < 2 else TAUPE, font=HEAD)
    text(s, x + 0.14, 2.55, cw - 0.28, 0.7, [lbl], size=10, color=INK)
    text(s, x + 0.14, 3.28, cw - 0.28, 0.25, [srcs], size=8, color=MUTED)
low = [("Why a system, not a campaign",
        "A 2024 12-site VA stepped-wedge trial on missed CRC and lung follow-up improved only at low-baseline sites: "
        "process redesign without infrastructure does not stick (AHRQ PSNet). LoopClose makes ownership, SLAs and closure structural."),
       ("Standards-aligned and tested",
        "Referral states follow IHE 360X and HL7 BSeR (ServiceRequest + Task); data is FHIR R4. 50 automated tests cover "
        "the state machine, SLA calendar, FHIR builders, API and analytics. The impact simulation's parameters are cited line by line.")]
for i, (h, body) in enumerate(low):
    x = L + i * (W / 2 + 0.075)
    w = W / 2 - 0.075
    box(s, x, 3.75, w, 1.58, fill=WHITE, line=SAND, name=f"evidence note {i+1}")
    circle(s, x + 0.15, 3.88, 0.36, "✓" if i else "!", fill=TEAL if i else RUST, size=12)
    text(s, x + 0.62, 3.88, w - 0.77, 0.32, [[(h, {"bold": True})]], size=11.5, font=HEAD)
    text(s, x + 0.62, 4.22, w - 0.77, 1.08, [body], size=9.5, color=GREY)

# =====================================================================
# Slide 8 - data sources
s = S[7]
set_header(s, "The prototype uses only synthetic data we generated: no personal data")
rows = [["Source", "Type", "Owner", "Sensitivity", "Permission / licence", "Personal data?"],
        ["Synthetic population and screening results (1,199 patients, 1,567 results, seed 42)", "Generated records (NDJSON)", "LoopClose (own generator)", "None", "Own work", ("No", TEAL)],
        ["Impact-simulation parameters", "Published aggregate statistics", "PMC8343888 authors, Joint Commission, AHRQ", "None", "Cited, open access", ("No", TEAL)],
        ["LOINC codes (FIT 29771-3, BI-RADS 72137-3)", "Terminology", "Regenstrief Institute", "None", "LOINC licence (free, attribution)", ("No", TEAL)],
        ["Message templates, programme and SLA configuration", "Authored content", "LoopClose", "None", "Own work; clinical sign-off before pilot", ("No", TEAL)],
        ["Claude API (navigator, summariser, grader)", "Model inference service", "Anthropic", "Receives synthetic data only; prompts hashed in audit", "Commercial API terms; can be disabled (template-only mode)", ("No", TEAL)],
        ["Pilot only: results via Malaffi / LIS / EMR", "FHIR R4 / HL7 v2 clinical data", "DoH / provider network", "PHI (high)", "DoH authorisation, DPA, patient consent, in-country hosting", ("Yes, pilot only", RUST)]]
table(s, L, 1.85, W, [2.45, 1.35, 1.5, 1.15, 1.75, 0.9], rows, size=8.5, row_h=0.47)

# =====================================================================
# Slide 9 - risks & safeguards
s = S[8]
set_header(s, "Safeguards are enforced in code, not left to policy")
risks = [
    ("Human oversight", "AI changes care without a human", "AI may enter only whitelisted states; it can never assign, close, exit or escalate. Unit-tested"),
    ("Failure modes", "A case stalls or a referral is lost", "An owner is mandatory; offer → accept hand-offs; durable SLA timers escalate to named roles"),
    ("Privacy", "PHI leaks to logs or model vendors", "Prompt hash only, never raw text; minimum-necessary fields; consent scopes; synthetic data only"),
    ("Security", "Cross-organisation data access", "JWT + role guard; org-scoped queries; audit of PHI access. Pilot: IdP + MFA, ADHICS"),
    ("Bias", "Weaker Arabic, Urdu or Hindi; skewed risk scores", "Native-speaker template review; per-language eval; no nationality or sex features"),
    ("Explainability", "Opaque risk flags", "Interpretable model with top-3 reasons and a suggested action; summaries trace back to source"),
    ("Misuse", "Prompt injection; diagnosis requests", "Patient text treated as data; rules-first safety grader fails closed; distress goes to a clinician"),
    ("AI risk tiering (DoH RAI)", "Proposed, to confirm with DDGO", "Navigator Medium · drop-off risk Medium · summariser Low–Medium · grader Low"),
]
gap = 0.14; cw = (W - gap * 3) / 4; ch_ = 1.68
for i, (cat, risk, guard) in enumerate(risks):
    x = L + (i % 4) * (cw + gap); y = 1.85 + (i // 4) * (ch_ + 0.12)
    last = i == 7
    box(s, x, y, cw, ch_, fill=TEAL_TINT if last else TINT, name=f"risk {cat}")
    text(s, x + 0.12, y + 0.1, cw - 0.24, 0.28, [[(cat, {"bold": True})]], size=11, font=HEAD, color=TEAL if last else INK)
    text(s, x + 0.12, y + 0.42, cw - 0.24, 0.4, [[("Status: " if last else "Risk: ", {"bold": True, "color": TEAL if last else RUST}), (risk, {})]], size=9, color=GREY)
    text(s, x + 0.12, y + 0.86, cw - 0.24, 0.8, [[("Tiers: " if last else "Safeguard: ", {"bold": True, "color": TEAL}), (guard, {})]], size=9, color=INK)

# =====================================================================
# Slide 10 - hardware
s = S[9]
set_header(s, "No hardware required: software only, on devices people already own")
b = box(s, L, 1.9, 2.6, 3.4, fill=TEAL, name="no hardware card")
text(s, L + 0.2, 2.15, 2.2, 1.0, [[("0", {"bold": True})]], size=60, color=WHITE, font=HEAD)
text(s, L + 0.2, 3.35, 2.2, 1.8, [[("devices, wearables or sensors to source, certify or maintain", {})]], size=13, color=WHITE, font=HEAD)
hw = [("Infrastructure", "Containerised services (API, web, PostgreSQL, HAPI FHIR) on in-country cloud, e.g. Azure UAE North, or on-premise. Stateless API scales horizontally."),
      ("Patients", "Their own phone: SMS, email or web chat. Phone outreach by a coordinator for anyone without a digital channel or who opts out."),
      ("Staff", "Existing desktops and browsers. No installation; role-based web access through the organisation's identity provider."),
      ("Safety & sourcing", "Not applicable: no physical device, so no device sourcing, electrical safety or medical-device certification is needed.")]
for i, (h, d) in enumerate(hw):
    y = 1.9 + i * 0.87
    box(s, 3.25, y, 6.3, 0.77, fill=TINT, name=f"hw {h}")
    text(s, 3.42, y + 0.08, 1.55, 0.6, [[(h, {"bold": True})]], size=11, font=HEAD, anchor=MSO_ANCHOR.MIDDLE)
    text(s, 4.95, y + 0.06, 4.5, 0.66, [d], size=9.5, color=GREY, anchor=MSO_ANCHOR.MIDDLE)

# =====================================================================
# Slide 11 - path to pilot & scale
s = S[10]
set_header(s, "One programme × one provider network × 6 months, then scale by configuration")
phases = [("1", "Readiness", "Months 0–3", "DoH AI authorisation & ADHICS review; DPA; Malaffi/LIS result feed; clinical sign-off of SLAs and templates; in-country hosting"),
          ("2", "Pilot", "Months 3–9", "IFHAS colorectal FIT at one network. Pre-registered primary outcome: colonoscopy ≤ 31 days vs baseline. Rules-only risk for 30 days"),
          ("3", "Scale", "Months 9–24", "Breast → cervical → lung → non-cancer actionable results (HbA1c, eGFR); more networks; other emirates via Riayati / NABIDH")]
gap = 0.15; cw = (W - gap * 2) / 3
for i, (n, h, when, d) in enumerate(phases):
    x = L + i * (cw + gap)
    box(s, x, 1.85, cw, 1.62, fill=TINT, name=f"phase {n}")
    circle(s, x + 0.14, 1.97, 0.4, n, size=13)
    text(s, x + 0.64, 1.95, cw - 0.75, 0.25, [[(h, {"bold": True})]], size=12, font=HEAD)
    text(s, x + 0.64, 2.2, cw - 0.75, 0.2, [when], size=9, color=TEAL)
    text(s, x + 0.14, 2.5, cw - 0.28, 0.96, [d], size=10, color=GREY)
    if i < 2:
        arrow(s, x + cw + 0.01, 2.66, x + cw + gap - 0.01, 2.66, width=1.25)
pillars = [("Stakeholders", "ADPHC (programme owner), DoH (RAI authorisation, ADHICS), Malaffi, provider network clinical leads, patients"),
           ("Integration", "FHIR R4 Subscription or HL7 v2 ORU in; adapters for EMR, scheduling and notifications; results written back as FHIR where permitted"),
           ("Regulatory", "DoH Responsible AI Standard (mapped clause by clause), ADHICS, ICT Health Law consent, in-country data residency; not a medical device"),
           ("Sustainability", "Annual platform fee per programme + per-actionable-case fee, so revenue tracks loops closed; outcome-linked tier for public payers")]
gap = 0.14; cw = (W - gap * 3) / 4
for i, (h, d) in enumerate(pillars):
    x = L + i * (cw + gap)
    box(s, x, 3.6, cw, 1.73, fill=WHITE, line=SAND, name=f"pillar {h}")
    text(s, x + 0.12, 3.68, cw - 0.24, 0.28, [[(h, {"bold": True})]], size=11, font=HEAD, color=TEAL)
    text(s, x + 0.12, 4.0, cw - 0.24, 1.3, [d], size=10.5, color=GREY)

# =====================================================================
# Slide 12 - IP & third-party
s = S[11]
set_header(s, "Our own code and content, built on permissive open source")
box(s, L, 1.85, 3.0, 3.48, fill=TEAL, name="ownership card")
text(s, L + 0.18, 1.97, 2.65, 3.3, [
    [("Ownership", {"bold": True, "size": 13, "font": HEAD})],
    "All source code, programme configuration, message templates, the synthetic data generator, the simulation model and the documentation were written by Syed Naazim Hussain for this challenge (from 24 Oct 2026).",
    "No pre-existing proprietary IP of any employer or third party is included.",
    "No copyleft licence applies to LoopClose's own code."], size=11, color=WHITE, space_after=8)
rows = [["Component", "Licence", "Notes"],
        ["HAPI FHIR v8 server", "Apache-2.0", "Unmodified Docker image"],
        ["PostgreSQL 16", "PostgreSQL Licence", "Permissive"],
        ["NestJS, Next.js, React, Radix UI, pg-boss, zod, pino", "MIT", "Application frameworks"],
        ["Prisma, RxJS, class-variance-authority", "Apache-2.0", ""],
        ["numpy, pandas, scikit-learn · simpy, pydantic", "BSD-3 · MIT", "Analytics (Python)"],
        ["@anthropic-ai/sdk · Claude API", "MIT · commercial terms", "Optional; template-only mode"],
        ["sharp / libvips (Next.js image optimisation)", "Apache-2.0 + LGPL-3.0", "Dynamically linked, unmodified"],
        ["LOINC codes · FHIR, 360X, BSeR specs", "LOINC licence · open", "Identifiers / public specs"],
        ["Submission template", "© organisers", "Used as provided"]]
table(s, 3.6, 1.85, 5.95, [2.75, 1.5, 1.7], rows, size=8.5, row_h=0.345)

# =====================================================================
# Slide 13 - conflict of interest
s = S[12]
set_header(s, "No conflicts of interest to declare")
box(s, L, 1.9, W, 0.95, fill=TINT, name="coi statement")
text(s, L + 0.25, 1.98, W - 0.5, 0.8, [[("Declaration: ", {"bold": True}),
     ("I, Syed Naazim Hussain (sole team member), have no employment, financial, advisory, family or other relationship "
      "with the organisers, co-creators, partners or judges of the Future Health Digital Innovation Challenge.", {})]],
     size=11, anchor=MSO_ANCHOR.MIDDLE)
coi = [("Organisers", "Future Health (Abu Dhabi), Department of Health Abu Dhabi, Hack2skill"),
       ("Co-creators & partners", "Microsoft, Inception, MBZUAI"),
       ("Judges & mentors", "Any member of the evaluation panel"),
       ("Competing interests", "Financial interest in a competing screening or results-management product")]
gap = 0.14; cw = (W - gap * 3) / 4
for i, (h, d) in enumerate(coi):
    x = L + i * (cw + gap)
    box(s, x, 3.0, cw, 2.3, fill=WHITE, line=SAND, name=f"coi {h}")
    text(s, x + 0.14, 3.12, cw - 0.28, 0.3, [[(h, {"bold": True})]], size=11, font=HEAD)
    text(s, x + 0.14, 3.45, cw - 0.28, 1.0, [d], size=9.5, color=GREY)
    b = box(s, x + 0.14, 4.7, 1.0, 0.42, fill=TEAL_TINT, radius=0.5, name=f"coi none {i+1}")
    fill_tf(b.text_frame, [[("None", {"bold": True})]], size=11, color=TEAL, align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)

# =====================================================================
# Slide 14 - additional: guarantees
s = S[13]
set_header(s, "Four guarantees enforced in code, whoever or whatever acts on a case", move_top=True)
hb = header_box(s)
hb.text_frame.paragraphs[0].runs[0].text = "Additional Slide"
g = [("Every open case has a named, accountable owner", "Hand-offs are offer → accept. A null owner is rejected by the state machine, so nothing becomes nobody's job."),
     ("Every step runs on a clock", "Durable SLA timers warn at 70% and escalate on breach to a named human role. Timers survive restarts."),
     ("A case closes only with evidence or an authorised human decision", "A procedure report, care plan or surveillance order, or a clinician's recorded reason. Otherwise the engine refuses."),
     ("AI proposes; humans decide", "AI cannot assign, close, exit or escalate. Every AI call is audited (model, version, prompt hash) and has a kill switch.")]
for i, (h, d) in enumerate(g):
    y = 1.9 + i * 0.86
    circle(s, L, y + 0.04, 0.44, str(i + 1), size=13)
    text(s, L + 0.6, y, 5.2, 0.26, [[(h, {"bold": True})]], size=11.5, font=HEAD)
    text(s, L + 0.6, y + 0.28, 5.2, 0.5, [d], size=9.5, color=GREY)
box(s, 6.45, 1.88, 3.1, 3.45, fill=TINT, name="links card")
text(s, 6.65, 2.0, 2.75, 3.25, [
    [("See it working", {"bold": True, "size": 13, "font": HEAD})],
    [("Demo flow: ", {"bold": True}), ("positive FIT arrives → case opens with an owner and SLA → patient notified → referral declined and redirected → closure refused without evidence → closed with a colonoscopy report → dashboard.", {})],
    [("Run locally: ", {"bold": True}), ("docker compose up + pnpm dev, with the synthetic population pre-loaded.", {})],
    [("Links: ", {"bold": True}), ("repository, hosted sandbox and the 7-minute demo video are included with the final submission.", {})]],
    size=10.5, color=INK, space_after=9)

prs.save(out)
print("saved", out)
