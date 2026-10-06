"""Compute detection metrics from saved predictions, mirroring Ultralytics' DetMetrics.

Reads /tmp/preds/<split>.jsonl (raw model output) and /tmp/evalds/labels/<split>
(cleaned YOLO labels) and writes /tmp/preds/metrics_<split>.json.
"""
import os, sys, json
import numpy as np

NAMES = ["helmet", "gloves", "vest", "boots", "goggles", "person"]
NC = len(NAMES)
IOUV = np.linspace(0.5, 0.95, 10)
ROOT = "/tmp/evalds"
PRED = "/tmp/preds"


def load_gt(split, stem):
    p = f"{ROOT}/labels/{split}/{stem}.txt"
    if not os.path.exists(p):
        return np.zeros((0, 5))
    rows = []
    for line in open(p):
        if not line.strip():
            continue
        v = line.split()
        rows.append([float(x) for x in v[:5]])
    return np.array(rows) if rows else np.zeros((0, 5))


def xywhn_to_xyxy(a, w, h):
    out = np.zeros((len(a), 4))
    cx, cy, bw, bh = a[:, 1] * w, a[:, 2] * h, a[:, 3] * w, a[:, 4] * h
    out[:, 0] = cx - bw / 2
    out[:, 1] = cy - bh / 2
    out[:, 2] = cx + bw / 2
    out[:, 3] = cy + bh / 2
    return out


def box_iou(a, b):
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)))
    a = a[:, None, :]
    inter = (np.minimum(a[..., 2], b[:, 2]) - np.maximum(a[..., 0], b[:, 0])).clip(0) * \
            (np.minimum(a[..., 3], b[:, 3]) - np.maximum(a[..., 1], b[:, 1])).clip(0)
    aa = (a[..., 2] - a[..., 0]) * (a[..., 3] - a[..., 1])
    ab = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    return inter / (aa + ab - inter + 1e-9)


def match(pred_cls, pred_box, gt_cls, gt_box):
    """Returns tp array (n_pred, n_iou) — Ultralytics match_predictions logic."""
    correct = np.zeros((len(pred_cls), len(IOUV)), dtype=bool)
    if len(gt_cls) == 0 or len(pred_cls) == 0:
        return correct
    iou = box_iou(gt_box, pred_box)              # (n_gt, n_pred)
    same = gt_cls[:, None] == pred_cls[None, :]
    iou = iou * same
    for i, thr in enumerate(IOUV):
        gi, pi = np.nonzero(iou >= thr)
        if len(gi):
            m = np.stack([gi, pi, iou[gi, pi]], 1)
            m = m[m[:, 2].argsort()[::-1]]
            m = m[np.unique(m[:, 1], return_index=True)[1]]
            m = m[np.unique(m[:, 0], return_index=True)[1]]
            correct[m[:, 1].astype(int), i] = True
    return correct


def smooth(y, f=0.05):
    nf = round(len(y) * f * 2) // 2 + 1
    p = np.ones(nf // 2)
    yp = np.concatenate((p * y[0], y, p * y[-1]), 0)
    return np.convolve(yp, np.ones(nf) / nf, mode="valid")


def compute_ap(recall, precision):
    mrec = np.concatenate(([0.0], recall, [1.0]))
    mpre = np.concatenate(([1.0], precision, [0.0]))
    mpre = np.flip(np.maximum.accumulate(np.flip(mpre)))
    x = np.linspace(0, 1, 101)
    return np.trapz(np.interp(x, mrec, mpre), x), mpre, mrec


def ap_per_class(tp, conf, pred_cls, target_cls, eps=1e-16):
    i = np.argsort(-conf)
    tp, conf, pred_cls = tp[i], conf[i], pred_cls[i]
    unique_classes, nt = np.unique(target_cls, return_counts=True)
    nc_ = len(unique_classes)
    x = np.linspace(0, 1, 1000)
    ap = np.zeros((nc_, tp.shape[1]))
    p_curve = np.zeros((nc_, 1000))
    r_curve = np.zeros((nc_, 1000))
    prec_at_50, rec_at_50 = [], []
    for ci, c in enumerate(unique_classes):
        m = pred_cls == c
        n_l, n_p = nt[ci], m.sum()
        if n_p == 0 or n_l == 0:
            continue
        fpc = (1 - tp[m]).cumsum(0)
        tpc = tp[m].cumsum(0)
        recall = tpc / (n_l + eps)
        r_curve[ci] = np.interp(-x, -conf[m], recall[:, 0], left=0)
        precision = tpc / (tpc + fpc)
        p_curve[ci] = np.interp(-x, -conf[m], precision[:, 0], left=1)
        for j in range(tp.shape[1]):
            ap[ci, j], _, _ = compute_ap(recall[:, j], precision[:, j])
        prec_at_50.append(precision[:, 0])
        rec_at_50.append(recall[:, 0])
    f1_curve = 2 * p_curve * r_curve / (p_curve + r_curve + eps)
    idx = smooth(f1_curve.mean(0), 0.1).argmax()
    p, r, f1 = p_curve[:, idx], r_curve[:, idx], f1_curve[:, idx]
    return {
        "classes": unique_classes.astype(int).tolist(),
        "nt": nt.tolist(),
        "p": p.tolist(), "r": r.tolist(), "f1": f1.tolist(),
        "ap50": ap[:, 0].tolist(), "ap": ap.mean(1).tolist(),
        "conf_at_max_f1": float(x[idx]),
        "p_curve": p_curve.tolist(), "r_curve": r_curve.tolist(),
        "f1_curve": f1_curve.tolist(), "x": x.tolist(),
    }


def confusion_matrix(all_data, conf_t=0.25, iou_t=0.45):
    cm = np.zeros((NC + 1, NC + 1), dtype=int)   # rows = pred, cols = gt; last = background
    for d in all_data:
        pb, pc, pf = d["pb"], d["pc"], d["pf"]
        keep = pf > conf_t
        pb, pc = pb[keep], pc[keep]
        gb, gc = d["gb"], d["gc"]
        if len(gc) == 0:
            for c in pc:
                cm[int(c), NC] += 1
            continue
        if len(pc) == 0:
            for c in gc:
                cm[NC, int(c)] += 1
            continue
        iou = box_iou(gb, pb)
        gi, pi = np.nonzero(iou >= iou_t)
        if len(gi):
            m = np.stack([gi, pi, iou[gi, pi]], 1)
            m = m[m[:, 2].argsort()[::-1]]
            m = m[np.unique(m[:, 1], return_index=True)[1]]
            m = m[np.unique(m[:, 0], return_index=True)[1]]
        else:
            m = np.zeros((0, 3))
        mg = m[:, 0].astype(int)
        mp = m[:, 1].astype(int)
        for k in range(len(gc)):
            j = np.where(mg == k)[0]
            if len(j):
                cm[int(pc[mp[j[0]]]), int(gc[k])] += 1
            else:
                cm[NC, int(gc[k])] += 1
        for k in range(len(pc)):
            if k not in mp:
                cm[int(pc[k]), NC] += 1
    return cm


def run(split):
    seen = {}
    for line in open(f"{PRED}/{split}.jsonl"):
        r = json.loads(line)
        seen[r["img"]] = r
    stats_tp, stats_conf, stats_pcls, stats_tcls = [], [], [], []
    all_data = []
    n_pred_boxes = 0
    for name, r in seen.items():
        stem = os.path.splitext(name)[0]
        g = load_gt(split, stem)
        gc = g[:, 0].astype(int) if len(g) else np.zeros(0, dtype=int)
        gb = xywhn_to_xyxy(g, r["w"], r["h"]) if len(g) else np.zeros((0, 4))
        pb = np.array(r["boxes"]).reshape(-1, 4)
        pf = np.array(r["conf"])
        pc = np.array(r["cls"], dtype=int)
        n_pred_boxes += len(pc)
        tp = match(pc, pb, gc, gb)
        stats_tp.append(tp)
        stats_conf.append(pf)
        stats_pcls.append(pc)
        stats_tcls.append(gc)
        all_data.append({"pb": pb, "pc": pc, "pf": pf, "gb": gb, "gc": gc})
    tp = np.concatenate(stats_tp, 0)
    conf = np.concatenate(stats_conf, 0)
    pcls = np.concatenate(stats_pcls, 0)
    tcls = np.concatenate(stats_tcls, 0)
    res = ap_per_class(tp, conf, pcls, tcls)
    cm = confusion_matrix(all_data)
    out = {
        "split": split,
        "n_images": len(seen),
        "n_gt": int(len(tcls)),
        "n_pred_raw": int(n_pred_boxes),
        "per_class": {NAMES[c]: {
            "instances": res["nt"][i], "P": res["p"][i], "R": res["r"][i],
            "F1": res["f1"][i], "mAP50": res["ap50"][i], "mAP50_95": res["ap"][i],
        } for i, c in enumerate(res["classes"])},
        "overall": {
            "P": float(np.mean(res["p"])), "R": float(np.mean(res["r"])),
            "F1": float(np.mean(res["f1"])),
            "mAP50": float(np.mean(res["ap50"])), "mAP50_95": float(np.mean(res["ap"])),
            "conf_at_max_f1": res["conf_at_max_f1"],
        },
        "confusion_matrix": cm.tolist(),
        "curves": {k: res[k] for k in ["p_curve", "r_curve", "f1_curve", "x"]},
        "classes": res["classes"],
    }
    json.dump(out, open(f"{PRED}/metrics_{split}.json", "w"))
    o = out["overall"]
    print(f"{split}: imgs={out['n_images']} gt={out['n_gt']} "
          f"P={o['P']:.3f} R={o['R']:.3f} F1={o['F1']:.3f} "
          f"mAP50={o['mAP50']:.4f} mAP50-95={o['mAP50_95']:.4f}")
    for k, v in out["per_class"].items():
        print(f"   {k:8s} n={v['instances']:5d} P={v['P']:.3f} R={v['R']:.3f} "
              f"F1={v['F1']:.3f} mAP50={v['mAP50']:.4f} mAP50-95={v['mAP50_95']:.4f}")


for s in sys.argv[1:]:
    run(s)
