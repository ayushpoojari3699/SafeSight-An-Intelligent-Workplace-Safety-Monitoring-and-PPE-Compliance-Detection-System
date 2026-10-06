"""Build the SafeSight project + model evaluation report as a PDF."""
import json, os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                Table, TableStyle, Image, PageBreak, KeepTogether)

OUT = "/sessions/zealous-youthful-rubin/mnt/PPE/SafeSight_Project_and_Model_Evaluation_Report.pdf"
FIG = "/tmp/fig"
NAMES = ["helmet", "gloves", "vest", "boots", "goggles", "person"]
M = {s: json.load(open(f"/tmp/preds/metrics_{s}.json")) for s in ["train", "val", "test"]}
DS = json.load(open("/tmp/dataset_stats.json"))

NAVY = colors.HexColor("#1f3a5f")
TEAL = colors.HexColor("#2a9d8f")
AMBER = colors.HexColor("#e9a13b")
GREY = colors.HexColor("#5b6572")
LIGHT = colors.HexColor("#eef2f6")
LINE = colors.HexColor("#c9d3de")

ss = getSampleStyleSheet()
S = {
    "title": ParagraphStyle("t", parent=ss["Title"], fontName="Helvetica-Bold",
                            fontSize=25, leading=29, textColor=NAVY, spaceAfter=4),
    "sub": ParagraphStyle("s", parent=ss["Normal"], fontSize=11.5, leading=15,
                          textColor=GREY, alignment=TA_CENTER),
    "h1": ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=15,
                         leading=19, textColor=NAVY, spaceBefore=16, spaceAfter=7),
    "h2": ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=11.5,
                         leading=14, textColor=colors.HexColor("#2c4a70"), spaceBefore=11, spaceAfter=4),
    "body": ParagraphStyle("b", parent=ss["Normal"], fontSize=9.6, leading=14.2,
                           alignment=TA_JUSTIFY, spaceAfter=6, textColor=colors.HexColor("#1c2530")),
    "bullet": ParagraphStyle("bu", parent=ss["Normal"], fontSize=9.6, leading=14,
                             leftIndent=12, bulletIndent=3, spaceAfter=3.5,
                             textColor=colors.HexColor("#1c2530")),
    "cap": ParagraphStyle("c", parent=ss["Normal"], fontSize=8, leading=10.5,
                          textColor=GREY, alignment=TA_CENTER, spaceBefore=3, spaceAfter=9),
    "cell": ParagraphStyle("cl", parent=ss["Normal"], fontSize=8.4, leading=11),
    "cellb": ParagraphStyle("clb", parent=ss["Normal"], fontSize=8.4, leading=11,
                            fontName="Helvetica-Bold"),
    "note": ParagraphStyle("n", parent=ss["Normal"], fontSize=9, leading=13,
                           textColor=colors.HexColor("#5a4200"), alignment=TA_JUSTIFY),
}


def P(t, st="body"):
    return Paragraph(t, S[st])


def bullets(items):
    return [Paragraph(f"&bull;&nbsp;&nbsp;{i}", S["bullet"]) for i in items]


def fig(name, caption, width=165 * mm):
    from PIL import Image as PILImage
    p = f"{FIG}/{name}"
    w, h = PILImage.open(p).size
    im = Image(p, width=width, height=width * h / w)
    return KeepTogether([im, P(caption, "cap")])


def table(data, widths, header=True, align=None, zebra=True):
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    st = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        st += [("BACKGROUND", (0, 0), (-1, 0), NAVY),
               ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
               ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
               ("FONTSIZE", (0, 0), (-1, 0), 8.4)]
    if zebra:
        for r in range(1 if header else 0, len(data)):
            if r % 2 == (1 if header else 0):
                st.append(("BACKGROUND", (0, r), (-1, r), LIGHT))
    if align:
        st.append(("ALIGN", (align, 1 if header else 0), (-1, -1), "CENTER"))
    t.setStyle(TableStyle(st))
    return t


def callout(text, color=AMBER):
    t = Table([[Paragraph(text, S["note"])]], colWidths=[165 * mm], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fdf6e6")),
        ("LINEBEFORE", (0, 0), (0, -1), 2.6, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def kpi_row(items):
    cells = []
    for label, value, sub in items:
        inner = Table([[Paragraph(f'<font size=15 color="#1f3a5f"><b>{value}</b></font>', S["cell"])],
                       [Paragraph(f'<font size=8 color="#5b6572">{label}</font>', S["cell"])],
                       [Paragraph(f'<font size=7 color="#8a94a1">{sub}</font>', S["cell"])]],
                      colWidths=[38 * mm])
        inner.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                   ("TOPPADDING", (0, 0), (-1, -1), 1),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 1)]))
        cells.append(inner)
    t = Table([cells], colWidths=[41 * mm] * len(items), hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


# --------------------------------------------------------------------------
story = []
A = story.append

# ---------------- cover ----------------
A(Spacer(1, 42 * mm))
A(P("SafeSight", "title"))
A(P("AI-Powered Construction Safety Intelligence Platform", "sub"))
A(Spacer(1, 4 * mm))
A(P("Project Report &amp; Full Model Evaluation", "sub"))
A(Spacer(1, 14 * mm))
cov = Table([["Detection model", "YOLOv8m (25.8 M params, 78.7 GFLOPs)"],
             ["Classes", "helmet · gloves · vest · boots · goggles · person"],
             ["Evaluation", "train / val / test, re-run from the trained checkpoint"],
             ["Test mAP@50", f"{M['test']['overall']['mAP50']:.3f}"],
             ["Test mAP@50-95", f"{M['test']['overall']['mAP50_95']:.3f}"],
             ["Backend / Frontend", "FastAPI + MongoDB · React 19 + Vite"],
             ["AI assistant", "LangGraph + FAISS + MiniLM + configurable LLM"],
             ["Report date", "12 August 2026"]],
            colWidths=[45 * mm, 110 * mm], hAlign="CENTER")
cov.setStyle(TableStyle([
    ("FONTSIZE", (0, 0), (-1, -1), 9.2),
    ("TEXTCOLOR", (0, 0), (0, -1), GREY),
    ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
    ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor("#1c2530")),
    ("LINEBELOW", (0, 0), (-1, -2), 0.4, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
A(cov)
A(PageBreak())

# ---------------- 1. executive summary ----------------
A(P("1. Executive summary", "h1"))
o = M["test"]["overall"]
A(P(
    "SafeSight is an end-to-end workplace-safety platform. A YOLOv8m detector locates workers and five "
    "categories of personal protective equipment in images and video; a geometry-aware association layer "
    "attaches each detected item to the correct worker; a rule engine converts that into per-worker "
    "violations, a risk level and a compliance percentage; and everything is persisted in MongoDB behind a "
    "JWT-authenticated FastAPI backend with a React admin console. A retrieval-augmented assistant answers "
    "natural-language questions over both the inspection history and uploaded safety manuals."))
A(P(
    "This report re-evaluates the trained checkpoint (<font face='Courier'>runs/train_m/weights/best.pt</font>) "
    "from scratch on all three dataset splits and reports every standard detection metric — precision, recall, "
    "F1, mAP@50, mAP@50-95, per-class breakdowns, confusion matrix and inference speed — then places those "
    "numbers in the context of the wider system."))
A(Spacer(1, 3 * mm))
A(kpi_row([
    ("Test mAP@50", f"{o['mAP50']:.3f}", "141 images · 1,097 objects"),
    ("Test mAP@50-95", f"{o['mAP50_95']:.3f}", "IoU 0.50:0.95"),
    ("Test precision", f"{o['P']:.3f}", f"at conf {o['conf_at_max_f1']:.2f}"),
    ("Test recall", f"{o['R']:.3f}", "max-F1 operating point"),
]))
A(Spacer(1, 4 * mm))
A(P("Headline findings", "h2"))
A(P(
    f"<b>The detector generalises well.</b> Test mAP@50 ({M['test']['overall']['mAP50']:.3f}) is essentially "
    f"identical to validation ({M['val']['overall']['mAP50']:.3f}) and only "
    f"{(M['train']['overall']['mAP50'] - M['test']['overall']['mAP50']) * 100:.1f} points below the training-set "
    f"score ({M['train']['overall']['mAP50']:.3f}). A gap that small after 20 epochs indicates the model is "
    f"under-fitted rather than over-fitted — there is headroom in more training, not less."))
A(P(
    "<b>Localisation quality, not detection, is the weak point.</b> mAP@50-95 "
    f"({o['mAP50_95']:.3f}) is roughly half of mAP@50 ({o['mAP50']:.3f}). The model finds the right objects but "
    "its boxes are loose; at strict IoU thresholds those detections stop counting. This is the single largest "
    "available gain."))
A(P(
    "<b>Small, low-texture classes lag.</b> Boots (mAP@50 "
    f"{M['test']['per_class']['boots']['mAP50']:.3f}, recall {M['test']['per_class']['boots']['R']:.3f}) and "
    f"person ({M['test']['per_class']['person']['mAP50']:.3f}) trail helmet "
    f"({M['test']['per_class']['helmet']['mAP50']:.3f}) and vest "
    f"({M['test']['per_class']['vest']['mAP50']:.3f}). Goggles score respectably despite having only "
    f"{DS['test']['per_class']['goggles']} test instances, so that figure carries wide error bars."))
A(P(
    "<b>Two data problems need attention before the next training run.</b> About 21% of label files contain "
    "annotations for classes 7-10, which do not exist in a 6-class configuration; and the val figures here "
    "sit ~4 points below what the training log recorded, which points at the label set having changed since "
    "training. Both are detailed in section 4."))

# ---------------- 2. system architecture ----------------
A(P("2. System architecture", "h1"))
A(P(
    "The platform is four cooperating layers. Nothing in the detection path depends on the assistant, and the "
    "assistant degrades gracefully — if no LLM is reachable, detection, dashboards and PDF reports still work."))
arch = [
    [Paragraph("<b>Layer</b>", S["cellb"]), Paragraph("<b>Components</b>", S["cellb"]),
     Paragraph("<b>Responsibility</b>", S["cellb"])],
    [P("Client", "cell"), P("React 19, Vite, React Router 7, Axios, Lucide, jsPDF", "cell"),
     P("Login, read-only dashboard with filters and charts, AI assistant chat, and a six-section admin console.", "cell")],
    [P("Application", "cell"), P("FastAPI (<font face='Courier'>api.py</font>, 29 routes), <font face='Courier'>auth.py</font>", "cell"),
     P("REST API, JWT issue/verify with bcrypt hashing, role dependencies (<font face='Courier'>get_current_user</font>, "
       "<font face='Courier'>require_admin</font>) enforced server-side.", "cell")],
    [P("Vision", "cell"), P("<font face='Courier'>detect.py</font>, <font face='Courier'>associate.py</font>, "
                            "<font face='Courier'>ppe_geometry.py</font>, <font face='Courier'>violation_checker.py</font>, "
                            "<font face='Courier'>risk_engine.py</font>", "cell"),
     P("YOLOv8m inference &rarr; PPE-to-worker association &rarr; plausibility filtering &rarr; violation and "
       "risk scoring &rarr; compliance percentage.", "cell")],
    [P("Intelligence", "cell"), P("<font face='Courier'>langgraph_pipeline.py</font> (10 nodes), FAISS, "
                                  "all-MiniLM-L6-v2, configurable LLM", "cell"),
     P("Intent routing, retrieval over manuals and inspection records, grounded answer generation with citations.", "cell")],
    [P("Storage", "cell"), P("MongoDB, FAISS index, pickled chunks/embeddings", "cell"),
     P("Users, detection history, documents; 134 indexed chunks over the uploaded safety manuals.", "cell")],
]
A(table(arch, [24 * mm, 55 * mm, 86 * mm]))
A(Spacer(1, 4 * mm))
A(P("2.1 Detection pipeline", "h2"))
A(P(
    "Inference runs at confidence 0.50 and NMS IoU 0.45. Every detected PPE box is then scored against every "
    "person box by <font face='Courier'>ppe_geometry.py</font>, which applies four independent checks before "
    "the item is credited to a worker: a per-class confidence floor (0.55 for person/helmet/vest, 0.60 for the "
    "flimsier gloves/boots/goggles); at least 60% of the PPE box contained inside the person box; a plausible "
    "vertical body band (a helmet must sit in the top 35% of the person, boots in the bottom 40%); and a "
    "plausible size ratio, which is what rejects a hi-vis vest being held up rather than worn. Unmatched boxes "
    "are dropped rather than forced onto the nearest worker."))
A(P(
    "A worker counts as <i>Safe</i> only with all five items present. Compliance is reported as "
    "<i>items present / items required</i> — the same formula everywhere in the app — so a worker missing only "
    "goggles reads as 80% rather than 0%. For video, an item must be detected in 3 of any 5 consecutive frames "
    "before it is confirmed, and identity is tracked by positional continuity rather than colour histogram, "
    "because putting a vest on destroys a histogram signature."))
A(P("2.2 RAG assistant", "h2"))
A(P(
    "Documents are chunked at 1,000 characters with 200 characters of overlap, embedded with all-MiniLM-L6-v2 "
    "(384-d) and indexed in FAISS. A LangGraph workflow classifies the question, routes it to one of five "
    "retrieval branches (analytics, worker lookup, prevention search, manual search, inspection search), "
    "deduplicates, optionally builds report cards, attaches evidence, and generates a cited answer. The LLM is "
    "provider-agnostic — Groq, Gemini, OpenAI or local Ollama, selected by environment variable."))

A(PageBreak())

# ---------------- 3. dataset ----------------
A(P("3. Dataset", "h1"))
A(P(
    "The dataset is 1,416 annotated construction-site images in YOLO format, split roughly 80/10/10. Class "
    "balance is uneven: person is the most frequent label and goggles the rarest by a factor of about five."))
rows = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in
         ["Split", "Images", "Objects", "helmet", "gloves", "vest", "boots", "goggles", "person"]]]
for s in ["train", "val", "test"]:
    d = DS[s]
    rows.append([P(s, "cell"), P(f"{d['images']:,}", "cell"), P(f"{d['in_range_boxes']:,}", "cell")] +
                [P(f"{d['per_class'][n]:,}", "cell") for n in NAMES])
tot = {n: sum(DS[s]["per_class"][n] for s in ["train", "val", "test"]) for n in NAMES}
rows.append([Paragraph("<b>total</b>", S["cellb"]),
             Paragraph(f"<b>{sum(DS[s]['images'] for s in DS):,}</b>", S["cellb"]),
             Paragraph(f"<b>{sum(DS[s]['in_range_boxes'] for s in DS):,}</b>", S["cellb"])] +
            [Paragraph(f"<b>{tot[n]:,}</b>", S["cellb"]) for n in NAMES])
A(table(rows, [20 * mm, 18 * mm, 20 * mm] + [17.8 * mm] * 6, align=1))
A(Spacer(1, 3 * mm))
A(fig("class_distribution.png", "Figure 1 — Annotated instances per class. Goggles are under-represented in every split."))
A(callout(
    "<b>Data-quality issue — out-of-range class IDs.</b> 294 label files (20.8% of the dataset) contain boxes "
    "with class IDs 7, 8, 9 and 10, while <font face='Courier'>data.yaml</font> declares only 6 classes (0-5). "
    "That is 1,567 boxes in total — 1,267 train, 146 val, 154 test — and they always appear mixed in alongside "
    "valid 0-5 boxes, which is the signature of a second annotation source having been merged in with a "
    "different class map. Current Ultralytics versions abort with an assertion error on such labels. All "
    "evaluation in this report therefore runs on a cleaned copy of the labels with out-of-range boxes removed; "
    "the images and the valid boxes are untouched. A further 10 label files in the train split have no matching "
    "image and were ignored."))
A(Spacer(1, 3 * mm))

# ---------------- 4. training ----------------
A(P("4. Training configuration", "h1"))
tr = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in ["Setting", "Value", "Setting", "Value"]],
      [P("Base weights", "cell"), P("yolov8m.pt (COCO-pretrained)", "cell"), P("Epochs", "cell"), P("20", "cell")],
      [P("Image size", "cell"), P("640 × 640", "cell"), P("Batch size", "cell"), P("16", "cell")],
      [P("Optimiser", "cell"), P("auto (SGD/AdamW selection)", "cell"), P("Initial LR / final LR", "cell"), P("0.01 / 0.0001", "cell")],
      [P("Device", "cell"), P("CPU", "cell"), P("Wall-clock time", "cell"), P("18.1 hours", "cell")],
      [P("Augmentation", "cell"), P("mosaic 1.0, HSV, scale 0.5, fliplr 0.5, erasing 0.4", "cell"),
       P("close_mosaic", "cell"), P("last 10 epochs", "cell")],
      [P("Loss weights", "cell"), P("box 7.5 · cls 0.5 · dfl 1.5", "cell"), P("Checkpoint", "cell"), P("best.pt = epoch 20 (49.6 MB)", "cell")]]
A(table(tr, [30 * mm, 55 * mm, 33 * mm, 47 * mm]))
A(Spacer(1, 3 * mm))
A(fig("training_curves.png",
      "Figure 2 — Losses and validation metrics across the 20 training epochs."))
A(P(
    "All three training losses were still falling at epoch 20 and validation mAP had not plateaued — the run "
    "was stopped by the epoch budget, not by convergence. Validation loss tracks training loss without "
    "diverging, so there is no over-fitting signal; the model is simply under-trained. On CPU each epoch cost "
    "roughly 54 minutes, which is the practical reason the run was capped at 20."))
A(callout(
    "<b>Discrepancy worth flagging.</b> The training log's final validation scores were mAP@50 0.841 and "
    f"mAP@50-95 0.467 (the figures quoted in the README). Re-running validation now on the same split gives "
    f"mAP@50 {M['val']['overall']['mAP50']:.3f} and mAP@50-95 {M['val']['overall']['mAP50_95']:.3f}. The "
    "evaluation code used here was verified against Ultralytics' own validator on a common subset and agrees to "
    "within 0.003 mAP@50, so methodology does not explain the gap. The most likely cause is that the label "
    "files have been modified since 2 July (the same merge that introduced the out-of-range class IDs). "
    "<b>The 0.841 figure should not be quoted alongside the current dataset</b> — the numbers in this report "
    "are the ones reproducible from the repository as it stands today."))

A(PageBreak())

# ---------------- 5. evaluation ----------------
A(P("5. Model evaluation", "h1"))
A(P("5.1 Method", "h2"))
A(P(
    "The trained checkpoint was run over every image in the val (143) and test (141) splits, and over a "
    "250-image random sample of the train split (seed 0), at 640 px with confidence 0.001 and NMS IoU 0.7 — "
    "the standard evaluation settings, deliberately much lower than the 0.50 confidence used in production so "
    "that the full precision-recall curve is measurable. Predictions were matched to ground truth per class at "
    "ten IoU thresholds from 0.50 to 0.95; AP is the 101-point interpolated area under each precision-recall "
    "curve, and the reported P, R and F1 are taken at the confidence that maximises mean F1."))
A(P("5.2 Overall results", "h2"))
hdr = ["Split", "Images", "Objects", "Precision", "Recall", "F1", "mAP@50", "mAP@50-95"]
rows = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in hdr]]
for s in ["train", "val", "test"]:
    m = M[s]["overall"]
    lbl = "train (250-img sample)" if s == "train" else s
    rows.append([P(lbl, "cell"), P(f"{M[s]['n_images']}", "cell"), P(f"{M[s]['n_gt']:,}", "cell")] +
                [P(f"{m[k]:.3f}", "cell") for k in ["P", "R", "F1", "mAP50", "mAP50_95"]])
A(table(rows, [40 * mm, 17 * mm, 19 * mm] + [17.8 * mm] * 5, align=1))
A(Spacer(1, 3 * mm))
A(fig("split_summary.png", "Figure 3 — Overall metrics on each split.", 150 * mm))
A(P(
    f"The train-to-test gap is {(M['train']['overall']['mAP50'] - M['test']['overall']['mAP50']) * 100:.1f} "
    f"points of mAP@50 and {(M['train']['overall']['mAP50_95'] - M['test']['overall']['mAP50_95']) * 100:.1f} "
    "points of mAP@50-95. For a detector fine-tuned on "
    "~1,100 images that is a small gap, and it confirms the picture from the loss curves: the ceiling here is "
    "training budget and label quality, not generalisation."))

A(P("5.3 Per-class results", "h2"))
hdr = ["Class", "Instances", "Precision", "Recall", "F1", "mAP@50", "mAP@50-95"]
rows = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in hdr]]
for n in NAMES:
    c = M["test"]["per_class"][n]
    rows.append([P(n, "cell"), P(f"{c['instances']:,}", "cell")] +
                [P(f"{c[k]:.3f}", "cell") for k in ["P", "R", "F1", "mAP50", "mAP50_95"]])
c = M["test"]["overall"]
rows.append([Paragraph("<b>all</b>", S["cellb"]), Paragraph(f"<b>{M['test']['n_gt']:,}</b>", S["cellb"])] +
            [Paragraph(f"<b>{c[k]:.3f}</b>", S["cellb"]) for k in ["P", "R", "F1", "mAP50", "mAP50_95"]])
A(table(rows, [28 * mm, 22 * mm] + [23 * mm] * 5, align=1))
A(P("Test split, at the max-F1 operating point (confidence "
    f"{M['test']['overall']['conf_at_max_f1']:.2f}).", "cap"))
A(fig("test_prf1.png", "Figure 4 — Precision, recall and F1 per class on the test set.", 150 * mm))
A(fig("per_class_map.png", "Figure 5 — Per-class mAP across all three splits."))
A(P(
    "Precision is high and even across every class (0.81-0.91): when the model claims to see a piece of PPE it "
    "is usually right. Recall is what separates the classes. Helmets are found 90% of the time; boots only 61%, "
    "and person 65%. Boots and people are frequently occluded, cropped by the frame edge, or small in the image, "
    "and the person class additionally suffers from crowded scenes where individuals overlap heavily."))
A(P(
    "For a safety application this asymmetry matters more than the headline mAP. High precision with moderate "
    "recall means the system rarely accuses a compliant worker of a violation, but does miss genuine PPE — "
    "which, given the rule engine credits an item only when it is detected, biases the platform toward "
    "over-reporting violations rather than under-reporting them. That is the safer failure direction, but it "
    "will generate false alarms on boots in particular."))

A(PageBreak())
A(P("5.4 Confusion matrix", "h2"))
A(fig("confusion_test.png",
      "Figure 6 — Test confusion matrix at production thresholds (confidence 0.25, IoU 0.45), "
      "normalised by ground-truth column.", 128 * mm))
A(P(
    "Class confusion is almost non-existent — the off-diagonal PPE-to-PPE cells are essentially empty, with only "
    "a trace of vest predicted where a person is annotated. Every meaningful error is against background: boxes "
    "the model missed entirely (the background row) and boxes it invented (the background column). Boots (27% "
    "missed) and person (28% missed) dominate the misses, matching the recall figures. This is a useful "
    "diagnosis: the five PPE categories are visually distinct enough that the model never mistakes one for "
    "another, so improvement work should target detection sensitivity on small and occluded objects, not "
    "class discrimination."))

A(P("5.5 Confidence sweep", "h2"))
A(fig("curves_test.png",
      "Figure 7 — F1, precision and recall as a function of the confidence threshold (test set).", 168 * mm))
A(P(
    f"Mean F1 peaks at confidence {M['test']['overall']['conf_at_max_f1']:.2f}. The production pipeline runs at "
    "0.50, with per-class floors of 0.55-0.60 applied afterwards in "
    "<font face='Courier'>ppe_geometry.py</font>. That is a deliberate trade — the geometry filters need "
    "reasonably trustworthy boxes to reason about — but it sits to the right of the F1 optimum and therefore "
    "costs recall, most visibly on boots and goggles. If missed PPE proves more costly in practice than "
    "occasional false positives, lowering the class floors toward the F1 peak is the cheapest available lever "
    "and requires no retraining."))

A(P("5.6 Inference speed", "h2"))
A(P(
    "Timings were collected over 534 images during evaluation. The benchmark machine is a 2-core CPU container "
    "with no GPU, so these numbers are a floor, not a representative deployment figure — a mid-range GPU would "
    "typically be 30-60× faster for this model."))
sp = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in ["Metric", "Value", "Note"]],
      [P("Mean latency per image", "cell"), P("1,297 ms", "cell"), P("preprocess + inference + NMS, 640 px, batch 4", "cell")],
      [P("Throughput", "cell"), P("0.77 images/s", "cell"), P("2 CPU threads, no GPU", "cell")],
      [P("Model parameters", "cell"), P("25,843,234", "cell"), P("92 fused layers", "cell")],
      [P("Compute", "cell"), P("78.7 GFLOPs", "cell"), P("per 640×640 image", "cell")],
      [P("Checkpoint size", "cell"), P("49.6 MB", "cell"), P("best.pt, FP32", "cell")]]
A(table(sp, [45 * mm, 30 * mm, 90 * mm]))
A(P(
    "Real-time video on CPU is not achievable at this configuration. The realistic options are GPU inference, "
    "dropping to YOLOv8s/n (roughly 3-8× cheaper, at a few points of mAP), exporting to ONNX or OpenVINO with "
    "INT8 quantisation, or keeping the existing approach of sampling frames rather than processing every one."))

A(PageBreak())

# ---------------- 6. verification ----------------
A(P("6. Verification", "h1"))
A(P(
    "Because the metrics in this report were computed by a purpose-written evaluator rather than by "
    "Ultralytics' own validator, the two were run against each other on an identical 12-image subset of the "
    "validation split with identical settings."))
v = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in ["Metric", "Ultralytics validator", "This report's evaluator", "Difference"]],
     [P("Precision", "cell"), P("0.9853", "cell"), P("0.9855", "cell"), P("+0.0002", "cell")],
     [P("Recall", "cell"), P("0.9369", "cell"), P("0.9382", "cell"), P("+0.0013", "cell")],
     [P("mAP@50", "cell"), P("0.9568", "cell"), P("0.9593", "cell"), P("+0.0025", "cell")],
     [P("mAP@50-95", "cell"), P("0.6709", "cell"), P("0.6808", "cell"), P("+0.0099", "cell")]]
A(table(v, [35 * mm, 42 * mm, 45 * mm, 30 * mm], align=1))
A(P(
    "Agreement is within 0.003 on mAP@50 and 0.010 on mAP@50-95. The residual difference is expected: "
    "Ultralytics' validator uses rectangular batching with letterbox padding sized to each batch, while this "
    "evaluation uses square 640 px letterboxing, which shifts box coordinates by a pixel or two and therefore "
    "moves the strict-IoU scores slightly. The conclusion is that the numbers throughout this report are "
    "trustworthy to roughly ±0.01."))
A(Spacer(1, 2 * mm))
A(P("Reproducing these results", "h2"))
A(P(
    "Every figure in sections 3 and 5 comes from three scripts saved next to this report: "
    "<font face='Courier'>infer.py</font> (runs the checkpoint over each split and stores raw predictions), "
    "<font face='Courier'>metrics.py</font> (matching, AP integration, confusion matrix) and "
    "<font face='Courier'>charts.py</font> (all figures). They read the repository's own weights and labels and "
    "write nothing back into the dataset."))

# ---------------- 7. limitations ----------------
A(P("7. Limitations and risks", "h1"))
for h, t in [
    ("Label integrity",
     "1,567 boxes across 294 files carry class IDs outside the declared 6-class schema, and the current "
     "validation score does not reproduce the training log. Until the label set is reconciled, no reported "
     "metric for this project should be treated as final."),
    ("Small evaluation sets",
     "141 test images and 1,097 objects — and only 52 goggles instances. Per-class figures for goggles in "
     "particular have wide confidence intervals; a handful of images can move that number several points."),
    ("Recall on boots and person",
     "At 0.61 and 0.65 respectively, roughly a third of these objects are missed. Because the rule engine "
     "treats an undetected item as an absent item, missed boots surface directly as false violations."),
    ("Localisation quality",
     "mAP@50-95 of 0.44 means boxes are frequently loose. The geometry-based association layer reasons about "
     "containment ratios and size ratios, so imprecise boxes propagate into association errors, not just into "
     "the metric."),
    ("Single-model, single-dataset evaluation",
     "No cross-validation, no held-out site, and no test on footage from a different camera, lighting "
     "condition or geography. Performance on a genuinely new site is unmeasured."),
    ("Security posture",
     "Default admin/user accounts are seeded automatically with published passwords, and there is no rate "
     "limiting, audit logging or forced password reset. Acceptable for a demonstrator, not for deployment."),
    ("Privacy and third-party inference",
     "With a hosted LLM provider configured, inspection summaries and manual excerpts leave the machine as "
     "text. No images are sent, but the deployment decision should be explicit."),
]:
    A(Paragraph(f"<b>{h}.</b> {t}", S["bullet"]))

A(P("8. Recommended next steps", "h1"))
A(P("In descending order of expected return per unit of effort:", "body"))
steps = [[Paragraph(f"<b>{h}</b>", S["cellb"]) for h in ["#", "Action", "Expected effect"]],
         [P("1", "cell"), P("Reconcile the label set — decide whether classes 7-10 are a relabelling or "
                            "contamination, then either remap them into the 6-class schema or delete them, and "
                            "re-run validation.", "cell"),
          P("Restores trust in every reported number; may recover the missing ~4 points of val mAP.", "cell")],
         [P("2", "cell"), P("Train longer on GPU — 100-150 epochs with early stopping instead of 20 on CPU.", "cell"),
          P("Losses were still falling; this is the clearest source of gain, most of it in mAP@50-95.", "cell")],
         [P("3", "cell"), P("Add hard examples for boots and person: occluded feet, frame-edge crops, crowded "
                            "scenes, low-light.", "cell"),
          P("Directly targets the two worst recall figures and the largest source of false violations.", "cell")],
         [P("4", "cell"), P("Grow the goggles class — it has one fifth the instances of any other PPE class.", "cell"),
          P("Makes the goggles metric meaningful and reduces variance in the overall mAP.", "cell")],
         [P("5", "cell"), P("Re-tune the per-class confidence floors against the F1 curves in Figure 7.", "cell"),
          P("Free recall with no retraining; quantify the precision cost first.", "cell")],
         [P("6", "cell"), P("Export to ONNX/OpenVINO with INT8 quantisation, or switch to YOLOv8s for video.", "cell"),
          P("Makes near-real-time inference feasible without a GPU.", "cell")],
         [P("7", "cell"), P("Harden auth before any pilot: remove seeded credentials, force first-login reset, "
                            "add rate limiting and admin audit logging.", "cell"),
          P("Already on the project's own roadmap; blocking for any real deployment.", "cell")]]
A(table(steps, [8 * mm, 82 * mm, 75 * mm]))

A(P("9. Conclusion", "h1"))
A(P(
    f"SafeSight works end to end. The detector reaches {o['mAP50']:.3f} mAP@50 and {o['F1']:.3f} F1 on held-out "
    "test data with almost no class confusion, and the surrounding system — geometry-filtered association, a "
    "single consistent compliance formula, role-enforced APIs, a grounded retrieval assistant — is more "
    "carefully built than the model alone would suggest. The engineering around the model is its strongest "
    "asset."))
A(P(
    "The model itself is not yet finished, and the honest reading of these numbers is that it was stopped early "
    "rather than tuned to a limit: 20 CPU epochs, still-falling losses, a small train-test gap, and boxes that "
    "are accurate at IoU 0.5 but loose beyond it. Combined with a label set that no longer reproduces the "
    "training log, the priority is clear — fix the labels, then train properly on a GPU. Neither is difficult, "
    "and together they are likely worth more than any architectural change."))

# --------------------------------------------------------------------------
def decorate(canvas, doc):
    canvas.saveState()
    w, h = A4
    if doc.page == 1:
        canvas.setFillColor(NAVY)
        canvas.rect(0, h - 14 * mm, w, 14 * mm, stroke=0, fill=1)
        canvas.setFillColor(TEAL)
        canvas.rect(0, h - 16.5 * mm, w, 2.5 * mm, stroke=0, fill=1)
    else:
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.4)
        canvas.line(20 * mm, h - 15 * mm, w - 20 * mm, h - 15 * mm)
        canvas.setFont("Helvetica", 7.6)
        canvas.setFillColor(GREY)
        canvas.drawString(20 * mm, h - 13 * mm, "SafeSight — Project Report & Model Evaluation")
        canvas.drawRightString(w - 20 * mm, h - 13 * mm, "August 2026")
        canvas.line(20 * mm, 15 * mm, w - 20 * mm, 15 * mm)
        canvas.drawCentredString(w / 2, 10.5 * mm, str(doc.page))
    canvas.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                      topMargin=20 * mm, bottomMargin=20 * mm,
                      title="SafeSight — Project Report & Model Evaluation",
                      author="SafeSight")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=decorate)])
doc.build(story)
print("written:", OUT, os.path.getsize(OUT) // 1024, "KB")
