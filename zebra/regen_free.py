"""重生成 data/free.json 里指定主题的题目（保持 id 与题量不变）。

用法： python regen_free.py alva
"""
import json
import random
import sys

from build import ROOT, validate
from generator import generate_puzzle

COUNT = 24
PER_GROUP = {("alva", "easy"): 24, ("alva", "normal"): 24, ("alva", "hard"): 24}


def sig(p):
    return json.dumps(p["solution"], sort_keys=True, ensure_ascii=False)


def main(theme_key="alva"):
    path = ROOT / "data/free.json"
    bank = json.loads(path.read_text())
    used = {sig(p) for items in bank.values() for p in items}

    for diff in ("easy", "normal", "hard"):
        key = f"{theme_key}_{diff}"
        old = bank.get(key, [])
        out = []
        for i in range(1, COUNT + 1):
            for attempt in range(400):
                p = generate_puzzle(theme_key, diff)
                if sig(p) not in used:
                    break
            else:
                raise RuntimeError(f"cannot generate {key} #{i}")
            used.add(sig(p))
            p["id"] = f"{theme_key}-{diff}-{i:02d}"
            validate(p)
            out.append(p)
            print("generated", p["id"], p["clue_count"], flush=True)
        bank[key] = out

    content = json.dumps(bank, ensure_ascii=False, indent=2) + "\n"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(content)
    tmp.replace(path)
    print("written", path)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "alva")
