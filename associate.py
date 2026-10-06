import math

from ppe_geometry import (
    MIN_CONFIDENCE,
    association_score,
)


# Class IDs
HELMET = 0
GLOVES = 1
VEST = 2
BOOTS = 3
GOGGLES = 4
PERSON = 5

CLASS_TO_ITEM = {
    HELMET: "helmet",
    GLOVES: "gloves",
    VEST: "vest",
    BOOTS: "boots",
    GOGGLES: "goggles",
}


def box_center(box):
    x1, y1, x2, y2 = box
    return (
        (x1 + x2) / 2,
        (y1 + y2) / 2
    )


def inside_person(center, person_box):
    cx, cy = center
    x1, y1, x2, y2 = person_box

    return (
        x1 <= cx <= x2 and
        y1 <= cy <= y2
    )


def distance(c1, c2):
    return math.sqrt(
        (c1[0] - c2[0]) ** 2 +
        (c1[1] - c2[1]) ** 2
    )


def _box_area(box):
    x1, y1, x2, y2 = box
    return max(0, x2 - x1) * max(0, y2 - y1)


def _overlap_ratio(a, b):
    """Intersection area as a fraction of the smaller box's area."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    smaller = min(_box_area(a), _box_area(b))
    return (inter / smaller) if smaller > 0 else 0


def _horizontally_aligned(a, b, min_overlap_ratio=0.7):
    """True if the two boxes' x-ranges overlap by most of the narrower one."""
    ax1, _, ax2, _ = a
    bx1, _, bx2, _ = b
    overlap = max(0, min(ax2, bx2) - max(ax1, bx1))
    narrower = min(ax2 - ax1, bx2 - bx1)
    return narrower > 0 and (overlap / narrower) >= min_overlap_ratio


def _merge_box(a, b):
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def _person_shaped(box, max_aspect=0.62):
    """
    True if a box has roughly human proportions (taller than it is wide).

    Used as a veto on merging: a standing person's box is narrow, so any
    merge that produces a wide box has almost certainly swallowed a second
    person rather than reassembled one.
    """
    width = box[2] - box[0]
    height = box[3] - box[1]
    return height > 0 and (width / height) <= max_aspect


def _dedupe_person_boxes(
    people,
    overlap_threshold=0.65,
    vertical_gap_ratio=0.25,
    fragment_ratio=0.7,
):
    """
    Merge the multiple 'person' boxes YOLO sometimes emits for one worker.

    A clipboard, tool or arm position can split a single silhouette into a
    head box and a torso box. Left alone that invents a phantom worker with
    no PPE, fabricating violations and dragging compliance down.

    The hard part is doing that without eating real people. The previous
    rule merged any two boxes overlapping by more than 35% of the smaller
    one, which is routine when workers stand shoulder to shoulder or one
    stands partly behind another — so on multi-person footage two real
    workers were silently collapsed into one and their PPE pooled. That is
    far worse than a phantom worker: it under-counts the workforce and
    credits one person's helmet to another.

    Three conditions now have to hold together:

      1. the boxes genuinely overlap a lot (or are stacked with a small
         vertical gap and a shared horizontal span — the split-silhouette
         signature);
      2. at least one box is a *fragment* — clearly smaller than their
         union. Two whole people produce two comparably-sized boxes;
      3. the merged result is still person-shaped. Merging two people
         standing side by side yields a box wider than it is tall, which is
         the clearest possible signal that they aren't one person.
    """
    people = list(people)
    merged = []
    used = [False] * len(people)

    for i in range(len(people)):
        if used[i]:
            continue
        used[i] = True
        box = people[i]

        for j in range(i + 1, len(people)):
            if used[j]:
                continue
            other = people[j]

            overlaps = _overlap_ratio(box, other) > overlap_threshold

            ay1, ay2 = box[1], box[3]
            by1, by2 = other[1], other[3]
            height = max(ay2 - ay1, by2 - by1)
            gap = max(0, max(ay1, by1) - min(ay2, by2))
            stacked = _horizontally_aligned(box, other) and gap < height * vertical_gap_ratio

            if not (overlaps or stacked):
                continue

            candidate = _merge_box(box, other)
            union_area = _box_area(candidate)
            union_height = candidate[3] - candidate[1]

            smaller = box if _box_area(box) <= _box_area(other) else other
            smaller_height = smaller[3] - smaller[1]

            # A fragment of one person is small in BOTH area and height.
            # Height matters on its own: someone standing behind a colleague
            # produces a box that's mostly inside the front person's box and
            # smaller in area, but nearly as tall — which is precisely what
            # tells you it's a whole second person rather than a piece of
            # the first one.
            is_fragment = (
                union_area > 0
                and union_height > 0
                and (_box_area(smaller) / union_area) < fragment_ratio
                and (smaller_height / union_height) < fragment_ratio
            )

            # Two boxes sitting almost exactly on top of each other are one
            # person the detector reported twice (an NMS miss). Two people
            # cannot occupy the same rectangle, so this is safe to merge
            # even though neither box is a "fragment" of the other.
            near_duplicate = _overlap_ratio(box, other) > 0.9

            if (is_fragment or near_duplicate) and _person_shaped(candidate):
                box = candidate
                used[j] = True

        merged.append(box)

    return merged


def _unpack(box):
    """Pull (class id, confidence, xyxy) out of an ultralytics box."""
    cls = int(box.cls[0])
    coords = box.xyxy[0].tolist()
    try:
        confidence = float(box.conf[0])
    except (AttributeError, IndexError, TypeError):
        # Older/stubbed result objects may not carry per-box confidence;
        # None means "unknown", which the plausibility rules treat as
        # neutral rather than as a reason to reject.
        confidence = None
    return cls, confidence, coords


def associate_ppe(results, keep_person_box=False):
    """
    Turn raw detections into per-worker PPE state.

    Each PPE box is matched to the person it is most plausibly *worn by*,
    rather than to whichever person box happens to contain its center. See
    ppe_geometry.association_score for the rules — confidence floor,
    containment, body-region band, and size sanity. A box that fits nobody
    is dropped instead of being forced onto the nearest person, which is
    what used to turn stray equipment in the background (and PPE being
    carried rather than worn) into phantom compliance.
    """

    people = []
    ppe_objects = []

    for result in results:

        for box in result.boxes:

            cls, confidence, coords = _unpack(box)

            if cls == PERSON:

                # A weak person box is worth rejecting outright: it invents
                # a whole worker, fabricates five missing-PPE violations,
                # and drags the site's compliance number down with it.
                if confidence is not None and confidence < MIN_CONFIDENCE["person"]:
                    continue

                people.append(coords)

            elif cls in CLASS_TO_ITEM:

                ppe_objects.append(
                    {
                        "item": CLASS_TO_ITEM[cls],
                        "box": coords,
                        "confidence": confidence,
                    }
                )

    people = _dedupe_person_boxes(people)

    workers = []

    for index, person in enumerate(people):

        workers.append(
            {
                "worker_id": index + 1,
                "person_box": person,
                "helmet": False,
                "vest": False,
                "gloves": False,
                "boots": False,
                "goggles": False,
            }
        )

    # Score every (PPE box, worker) pair, then commit the best fits first so
    # an item that two people could claim goes to the one it actually sits
    # on. Each PPE box is consumed once — one glove box can't tick "gloves"
    # for two different workers.
    candidates = []
    for ppe_index, obj in enumerate(ppe_objects):
        for worker_index, worker in enumerate(workers):
            score = association_score(
                obj["item"],
                obj["box"],
                obj["confidence"],
                worker["person_box"],
            )
            if score is not None:
                candidates.append((score, ppe_index, worker_index))

    candidates.sort(key=lambda c: c[0], reverse=True)

    claimed_ppe = set()
    for score, ppe_index, worker_index in candidates:
        if ppe_index in claimed_ppe:
            continue
        claimed_ppe.add(ppe_index)
        workers[worker_index][ppe_objects[ppe_index]["item"]] = True

    rejected = len(ppe_objects) - len(claimed_ppe)

    if not keep_person_box:
        for worker in workers:
            worker.pop("person_box")

    # ✅ DEBUG: Print associated workers
    print("\n===== ASSOCIATED WORKERS =====")
    for worker in workers:
        print(worker)
    if rejected:
        print(f"{rejected} PPE detection(s) rejected as implausible (confidence / position / size)")
    print("=============================\n")

    return workers
