"""Resumable YOLO inference over the eval splits.

Runs for a bounded wall-clock budget, appends raw predictions to a JSONL file,
and can be re-invoked to continue where it left off.
"""
import os, sys, json, time, random

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")
BUDGET = float(sys.argv[1]) if len(sys.argv) > 1 else 38.0
ROOT = "/tmp/evalds"
OUT = "/tmp/preds"
os.makedirs(OUT, exist_ok=True)

TRAIN_SAMPLE = 250
SEED = 0

import torch
torch.set_num_threads(os.cpu_count() or 2)
from ultralytics import YOLO

WEIGHTS = "/sessions/zealous-youthful-rubin/mnt/PPE/runs/train_m/weights/best.pt"


def job_list(split):
    f = f"{OUT}/{split}_jobs.json"
    if os.path.exists(f):
        return json.load(open(f))
    imgs = sorted(os.listdir(f"{ROOT}/images/{split}"))
    if split == "train":
        random.Random(SEED).shuffle(imgs)
        imgs = sorted(imgs[:TRAIN_SAMPLE])
    json.dump(imgs, open(f, "w"))
    return imgs


def done_set(split):
    f = f"{OUT}/{split}.jsonl"
    if not os.path.exists(f):
        return set()
    s = set()
    for line in open(f):
        try:
            s.add(json.loads(line)["img"])
        except Exception:
            pass
    return s


def main():
    t0 = time.time()
    model = None
    total_infer_ms, n_timed = 0.0, 0
    for split in ["test", "val", "train"]:
        jobs = job_list(split)
        done = done_set(split)
        todo = [j for j in jobs if j not in done]
        if not todo:
            print(f"{split}: complete ({len(done)}/{len(jobs)})")
            continue
        if model is None:
            model = YOLO(WEIGHTS)
        fh = open(f"{OUT}/{split}.jsonl", "a")
        B = 4
        i = 0
        while i < len(todo) and time.time() - t0 < BUDGET:
            batch = todo[i:i + B]
            paths = [f"{ROOT}/images/{split}/{b}" for b in batch]
            res = model.predict(paths, conf=0.001, iou=0.7, max_det=300,
                                imgsz=640, verbose=False, device="cpu")
            for name, r in zip(batch, res):
                b = r.boxes
                rec = {
                    "img": name,
                    "h": int(r.orig_shape[0]), "w": int(r.orig_shape[1]),
                    "boxes": [[round(float(v), 2) for v in bb] for bb in b.xyxy.tolist()],
                    "conf": [round(float(c), 5) for c in b.conf.tolist()],
                    "cls": [int(c) for c in b.cls.tolist()],
                }
                fh.write(json.dumps(rec) + "\n")
                total_infer_ms += r.speed["inference"] + r.speed["preprocess"] + r.speed["postprocess"]
                n_timed += 1
            fh.flush()
            i += B
        fh.close()
        print(f"{split}: {len(done) + i}/{len(jobs)}")
        if time.time() - t0 >= BUDGET:
            break
    if n_timed:
        with open(f"{OUT}/speed.jsonl", "a") as f:
            f.write(json.dumps({"n": n_timed, "ms": total_infer_ms}) + "\n")


main()
