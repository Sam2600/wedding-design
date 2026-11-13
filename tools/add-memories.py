"""
Add photos to the memories page (memories.html).

    python tools/add-memories.py <album-id> <photo or folder> [...] [--title "Album title"] [--note "..."]
    python tools/add-memories.py --rebuild

Examples:
    python tools/add-memories.py bride memories-inbox/bride --title "The bride"
    python tools/add-memories.py dinner memories-inbox/dinner/IMG_0412.jpg memories-inbox/dinner/IMG_0415.jpg

For each photo it writes two files to public/memories/<album-id>/:
    <album-id>-NN-720.webp    grid thumbnail (~60 KB)
    <album-id>-NN-1600.webp   full-screen viewer (~300 KB; sharp on any phone)
and appends it to public/memories/albums.json (creating the album if it is new).
Photos already added (same source file name in that album) are skipped, so re-running is safe.
Afterwards, edit "alt" in albums.json to describe each photo.

--rebuild makes every album's files again from the originals in memories-inbox/<album-id>/,
keeping titles, descriptions and order (for a change of sizes or quality).

Videos are added by hand in albums.json; see README.md.

Needs Pillow (pip install pillow). The originals stay out of git, in memories-inbox/: keep a
copy of that folder somewhere safe, it is the only full-size copy.
"""

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "memories"
INBOX = ROOT / "memories-inbox"
MANIFEST = OUT / "albums.json"
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp", ".heic"}
THUMB = (720, 74)            # long edge in px, WebP quality
FULL = (1600, 82)


def collect(paths):
    files = []
    for p in map(Path, paths):
        if p.is_dir():
            files += sorted(f for f in p.iterdir() if f.suffix.lower() in IMAGE_TYPES)
        elif p.suffix.lower() in IMAGE_TYPES:
            files.append(p)
        else:
            sys.exit(f"Not a photo or folder: {p}")
    return files


def render(src, album_id, name):
    """Write the thumbnail and the full-size copy; return the photo's paths and size."""
    folder = OUT / album_id
    folder.mkdir(parents=True, exist_ok=True)
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    sizes = {}
    for label, (edge, quality) in (("thumb", THUMB), ("full", FULL)):
        copy = img.copy()
        copy.thumbnail((edge, edge), Image.LANCZOS)
        copy.save(folder / f"{name}-{edge}.webp", "WEBP", quality=quality, method=6)
        sizes[label] = copy
    base = f"/public/memories/{album_id}/{name}"
    return {
        "thumb": f"{base}-{THUMB[0]}.webp",
        "full": f"{base}-{FULL[0]}.webp",
        "width": sizes["full"].width,
        "height": sizes["full"].height,
    }


def save(manifest):
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def rebuild(manifest):
    missing = []
    for album in manifest["albums"]:
        photos = [item for item in album["items"] if item["type"] == "photo"]
        for item in photos:
            if not (INBOX / album["id"] / item["source"]).exists():
                missing.append(f"memories-inbox/{album['id']}/{item['source']}")
    if missing:
        sys.exit("Originals not found, nothing changed:\n  " + "\n  ".join(missing))

    for album in manifest["albums"]:
        folder = OUT / album["id"]
        if folder.exists():
            for old in folder.iterdir():
                if old.suffix in {".webp", ".jpg"}:
                    old.unlink()
        n = 0
        for item in album["items"]:
            if item["type"] != "photo":
                continue
            n += 1
            name = f"{album['id']}-{n:02d}"
            item.pop("download", None)
            item.update(render(INBOX / album["id"] / item["source"], album["id"], name))
            print(f"  rebuilt {album['id']}/{item['source']} -> {name}")
    save(manifest)
    print(f"Saved {MANIFEST.relative_to(ROOT)}.")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("album", nargs="?", help="short id, lowercase with dashes, e.g. bride or tea-ceremony")
    parser.add_argument("photos", nargs="*")
    parser.add_argument("--title", help="album title shown on the page (needed for a new album)")
    parser.add_argument("--note", default="", help="one line under the album title")
    parser.add_argument("--rebuild", action="store_true", help="make every album's files again from memories-inbox/")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"albums": []}
    if args.rebuild:
        return rebuild(manifest)
    if not args.album or not args.photos:
        parser.error("give an album id and at least one photo or folder (or --rebuild)")

    album = next((a for a in manifest["albums"] if a["id"] == args.album), None)
    if album is None:
        if not args.title:
            sys.exit(f'New album "{args.album}": add --title "..."')
        album = {"id": args.album, "title": args.title, "note": args.note, "items": []}
        # New photo albums go before the videos album
        videos_at = next((i for i, a in enumerate(manifest["albums"]) if a["id"] == "videos"), len(manifest["albums"]))
        manifest["albums"].insert(videos_at, album)
    elif args.title:
        album["title"] = args.title
    if args.note:
        album["note"] = args.note

    done = {item.get("source") for item in album["items"]}
    count = sum(1 for item in album["items"] if item["type"] == "photo")

    for src in collect(args.photos):
        if src.name in done:
            print(f"  skip {src.name} (already in {args.album})")
            continue
        count += 1
        name = f"{args.album}-{count:02d}"
        album["items"].append({
            "type": "photo",
            "source": src.name,
            **render(src, args.album, name),
            "alt": f"{album['title']}, photo {count}",
        })
        print(f"  added {src.name} -> {name}")

    save(manifest)
    print(f"Saved {MANIFEST.relative_to(ROOT)}. Now describe the new photos in their \"alt\" fields.")


if __name__ == "__main__":
    main()
