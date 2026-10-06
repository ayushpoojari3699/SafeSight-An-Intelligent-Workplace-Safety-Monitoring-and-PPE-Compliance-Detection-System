"""Generate all figures for the SafeSight project report."""
import json, os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

OUT = "/tmp/fig"
os.makedirs(OUT, exist_ok=True)
NAMES = ["helmet", "gloves", "vest", "boots", "goggles", "person"]
M = {s: json.load(open(f"/tmp/preds/metrics_{s}.json")) for s in ["train", "val", "test"]}
NAVY, TEAL, AMBER, RED = "#1f3a5f", "#2a9d8f", "#e9a13b", "#c1443c"
plt.rcParams.update({"font.size": 9, "axes.grid": True, "grid.alpha": .25,
                     "axes.spines.top": False, "axes.spines.right": False})

# ---------- 1. training curves ----------
df = pd.read_csv("/sessions/zealous-youthful-rubin/mnt/PPE/runs/train_m/results.csv")
df.columns = [c.strip() for c in df.columns]
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
for c, lbl, col in [("train/box_loss", "box", NAVY), ("train/cls_loss", "cls", TEAL), ("train/dfl_loss", "dfl", AMBER)]:
    ax[0].plot(df["epoch"], df[c], color=col, lw=1.8, label=f"train {lbl}")
for c, lbl, col in [("val/box_loss", "box", NAVY), ("val/cls_loss", "cls", TEAL), ("val/dfl_loss", "dfl", AMBER)]:
    ax[0].plot(df["epoch"], df[c], color=col, lw=1.4, ls="--", label=f"val {lbl}")
ax[0].set_title("Training / validation loss"); ax[0].set_xlabel("epoch"); ax[0].set_ylabel("loss")
ax[0].legend(fontsize=6.5, ncol=2)
ax[1].plot(df["epoch"], df["metrics/mAP50(B)"], color=NAVY, lw=2, label="mAP@50")
ax[1].plot(df["epoch"], df["metrics/mAP50-95(B)"], color=TEAL, lw=2, label="mAP@50-95")
ax[1].plot(df["epoch"], df["metrics/precision(B)"], color=AMBER, lw=1.3, ls="--", label="precision")
ax[1].plot(df["epoch"], df["metrics/recall(B)"], color=RED, lw=1.3, ls="--", label="recall")
ax[1].set_title("Validation metrics during training"); ax[1].set_xlabel("epoch"); ax[1].set_ylim(0, 1)
ax[1].legend(fontsize=7)
fig.tight_layout(); fig.savefig(f"{OUT}/training_curves.png", dpi=170); plt.close(fig)

# ---------- 2. per-class mAP across splits ----------
fig, ax = plt.subplots(1, 2, figsize=(9, 3.2))
x = np.arange(len(NAMES)); w = 0.26
for i, (s, col) in enumerate([("train", NAVY), ("val", TEAL), ("test", AMBER)]):
    ax[0].bar(x + (i - 1) * w, [M[s]["per_class"][n]["mAP50"] for n in NAMES], w, label=s, color=col)
    ax[1].bar(x + (i - 1) * w, [M[s]["per_class"][n]["mAP50_95"] for n in NAMES], w, label=s, color=col)
for a, t in zip(ax, ["mAP@50 by class", "mAP@50-95 by class"]):
    a.set_xticks(x); a.set_xticklabels(NAMES, rotation=20); a.set_ylim(0, 1); a.set_title(t); a.legend(fontsize=7)
fig.tight_layout(); fig.savefig(f"{OUT}/per_class_map.png", dpi=170); plt.close(fig)

# ---------- 3. precision / recall / F1 by class (test) ----------
fig, ax = plt.subplots(figsize=(6.6, 3.1))
for i, (k, col) in enumerate([("P", NAVY), ("R", TEAL), ("F1", AMBER)]):
    v = [M["test"]["per_class"][n][k] for n in NAMES]
    b = ax.bar(x + (i - 1) * w, v, w, label=k, color=col)
    ax.bar_label(b, fmt="%.2f", fontsize=6, padding=1)
ax.set_xticks(x); ax.set_xticklabels(NAMES, rotation=20); ax.set_ylim(0, 1.12)
ax.set_title("Test set — precision, recall, F1 by class"); ax.legend(fontsize=7, ncol=3)
fig.tight_layout(); fig.savefig(f"{OUT}/test_prf1.png", dpi=170); plt.close(fig)

# ---------- 4. F1 / P / R vs confidence (test) ----------
c = M["test"]["curves"]; xs = np.array(c["x"]); cls = M["test"]["classes"]
fig, ax = plt.subplots(1, 3, figsize=(10, 2.9), sharey=True)
for j, (key, title) in enumerate([("f1_curve", "F1"), ("p_curve", "Precision"), ("r_curve", "Recall")]):
    arr = np.array(c[key])
    for i, ci in enumerate(cls):
        ax[j].plot(xs, arr[i], lw=.9, alpha=.6, label=NAMES[ci])
    ax[j].plot(xs, arr.mean(0), lw=2.2, color="k", label="all classes")
    ax[j].set_title(f"{title} vs confidence"); ax[j].set_xlabel("confidence"); ax[j].set_ylim(0, 1)
ax[0].legend(fontsize=6, loc="lower left", ncol=2)
fig.tight_layout(); fig.savefig(f"{OUT}/curves_test.png", dpi=170); plt.close(fig)

# ---------- 5. confusion matrix (test, column-normalised) ----------
cm = np.array(M["test"]["confusion_matrix"], dtype=float)
lab = NAMES + ["background"]
cmn = cm / np.maximum(cm.sum(0, keepdims=True), 1)
fig, ax = plt.subplots(figsize=(5.4, 4.6))
im = ax.imshow(cmn, cmap="Blues", vmin=0, vmax=1)
ax.set_xticks(range(7)); ax.set_xticklabels(lab, rotation=45, ha="right")
ax.set_yticks(range(7)); ax.set_yticklabels(lab)
ax.set_xlabel("ground truth"); ax.set_ylabel("prediction")
ax.set_title("Test confusion matrix (column-normalised, conf 0.25 / IoU 0.45)", fontsize=8.5)
for i in range(7):
    for j in range(7):
        if cmn[i, j] > 0.005:
            ax.text(j, i, f"{cmn[i, j]:.2f}", ha="center", va="center", fontsize=6.5,
                    color="white" if cmn[i, j] > .5 else "black")
ax.grid(False); fig.colorbar(im, fraction=.046)
fig.tight_layout(); fig.savefig(f"{OUT}/confusion_test.png", dpi=170); plt.close(fig)

# ---------- 6. dataset class distribution ----------
dist = json.load(open("/tmp/dataset_stats.json"))
fig, ax = plt.subplots(1, 2, figsize=(9, 3.0))
for i, (s, col) in enumerate([("train", NAVY), ("val", TEAL), ("test", AMBER)]):
    ax[0].bar(x + (i - 1) * w, [dist[s]["per_class"][n] for n in NAMES], w, label=s, color=col)
ax[0].set_xticks(x); ax[0].set_xticklabels(NAMES, rotation=20); ax[0].set_yscale("log")
ax[0].set_title("Annotated instances per class (log scale)"); ax[0].legend(fontsize=7)
tot = [sum(dist[s]["per_class"][n] for s in ["train", "val", "test"]) for n in NAMES]
ax[1].barh(NAMES, tot, color=[NAVY, TEAL, AMBER, RED, "#7b5aa6", "#6c757d"])
for i, v in enumerate(tot):
    ax[1].text(v + 40, i, str(v), va="center", fontsize=7)
ax[1].set_title("Total instances across all splits"); ax[1].invert_yaxis()
fig.tight_layout(); fig.savefig(f"{OUT}/class_distribution.png", dpi=170); plt.close(fig)

# ---------- 7. split summary ----------
fig, ax = plt.subplots(figsize=(6.6, 3.0))
keys = ["P", "R", "F1", "mAP50", "mAP50_95"]
lbls = ["Precision", "Recall", "F1", "mAP@50", "mAP@50-95"]
xx = np.arange(len(keys))
for i, (s, col) in enumerate([("train", NAVY), ("val", TEAL), ("test", AMBER)]):
    b = ax.bar(xx + (i - 1) * w, [M[s]["overall"][k] for k in keys], w, label=f"{s} (n={M[s]['n_images']})", color=col)
    ax.bar_label(b, fmt="%.3f", fontsize=6, padding=1)
ax.set_xticks(xx); ax.set_xticklabels(lbls); ax.set_ylim(0, 1.12)
ax.set_title("Overall detection metrics by split"); ax.legend(fontsize=7)
fig.tight_layout(); fig.savefig(f"{OUT}/split_summary.png", dpi=170); plt.close(fig)

print("figures:", sorted(os.listdir(OUT)))
