"""One-time developer conversion for the offline wordbooks used by study.html.

Input: a checkout of https://github.com/grhliu/wordtyper-vocabularies
The browser never runs this script and never contacts the source repository.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path


BOOKS = {
    "kaoyan-required": ("kaoyan_high_freq.json", "考研必考词汇"),
    "kaoyan-complete": ("kaoyan.json", "考研完整词汇"),
    "cet6": ("cet6.json", "CET-6"),
    "cet4": ("cet4.json", "CET-4"),
}
SOURCE_URL = "https://github.com/grhliu/wordtyper-vocabularies"
UPSTREAM_URL = "https://github.com/skywind3000/ECDICT"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="wordtyper-vocabularies checkout")
    parser.add_argument("--output", type=Path, default=Path("data/wordbooks"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = []
    for book_id, (filename, display_name) in BOOKS.items():
        payload = json.loads((args.source / "vocabularies" / filename).read_text(encoding="utf-8"))
        words = []
        for index, item in enumerate(payload["words"], 1):
            translations = [text.strip() for text in item.get("translations", []) if text.strip()]
            if not item.get("word") or not translations:
                continue
            words.append({"id": f"{book_id}-{index:05d}", "word": item["word"].strip(), "meaning": "；".join(translations), "phonetic": item.get("phonetic", "").strip()})
        output = {"bookId": book_id, "name": display_name, "source": SOURCE_URL, "license": "MIT", "words": words}
        (args.output / f"{book_id}.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest.append({"bookId": book_id, "name": display_name, "source": SOURCE_URL, "upstream": UPSTREAM_URL, "license": "MIT", "totalWords": len(words), "file": f"./data/wordbooks/{book_id}.json"})
    (args.output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({item["bookId"]: item["totalWords"] for item in manifest}, ensure_ascii=False))


if __name__ == "__main__":
    main()
