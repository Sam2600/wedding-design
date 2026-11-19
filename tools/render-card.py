"""Redraw the reception card's download image from the page, so the two always match.

    python tools/render-card.py

The card's front in reception.html is set type (the printed card's words). Guests who tap
"Save the card" get public/images/reception/invitation-card.jpg, a picture of that front, and
link previews show public/images/reception/og-reception.jpg (the card beside our photo).
This script serves the repo on a spare local port, opens reception.html in a headless browser
(without its script, so the card shows face up with no envelope), photographs the card's front
at 3x and rebuilds both images.

The git pre-commit hook (tools/hooks/pre-commit, copied to .git/hooks/pre-commit) runs it
whenever a commit touches the card, so the download can't fall out of step with the page.

Needs Pillow and Playwright (pip install pillow playwright; it uses the Edge or Chrome already
installed, else Playwright's own Chromium: python -m playwright install chromium).
"""
import functools
import http.server
import io
import sys
import threading
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "images" / "reception"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def photograph_card():
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{server.server_address[1]}/reception.html"
    try:
        with sync_playwright() as p:
            browser = None
            for channel in ("msedge", "chrome", None):
                try:
                    browser = p.chromium.launch(channel=channel) if channel else p.chromium.launch()
                    break
                except Exception:
                    continue
            if browser is None:
                raise RuntimeError("No browser for Playwright: install Edge or Chrome, or run "
                                   "python -m playwright install chromium")
            page = browser.new_context(viewport={"width": 500, "height": 900}, device_scale_factor=3).new_page()
            # Without its script the page shows as it does without JavaScript: no envelope, card face up
            page.route("**/reception.js", lambda route: route.abort())
            page.goto(url, wait_until="load", timeout=30000)
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(400)
            # The download is the card itself: no shadow, square corners, no light sweep
            page.add_style_tag(content=".card-face{box-shadow:none!important;border-radius:0!important}"
                                       ".card-front::after{display:none}")
            page.wait_for_timeout(200)
            png = page.locator(".card-front").screenshot(timeout=15000)
            browser.close()
    finally:
        server.shutdown()
    return Image.open(io.BytesIO(png)).convert("RGB")


def link_preview(card):
    """1200 x 630: the card beside our photo on the paper colour, for Facebook, Viber and the rest"""
    og = Image.new("RGB", (1200, 630))
    draw = ImageDraw.Draw(og)
    for y in range(630):
        t = y / 630
        draw.line([(0, y), (1200, y)], fill=(int(245 - 12 * t), int(241 - 14 * t), int(246 - 10 * t)))
    c = card.resize((round(card.width * 540 / card.height), 540), Image.LANCZOS)
    photo = Image.open(OUT / "card-photo-900.jpg").convert("RGB")
    photo = photo.resize((round(photo.width * 540 / photo.height), 540), Image.LANCZOS)
    x1, x2 = 600 - c.width - 20, 620
    shadow = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    for x, im in ((x1, c), (x2, photo)):
        sd.rectangle([x + 6, 59, x + im.width + 6, 599], fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(14))
    og.paste(shadow, (0, 0), shadow)
    og.paste(c, (x1, 45))
    og.paste(photo, (x2, 45))
    ImageDraw.Draw(og).rectangle([x2 - 1, 44, x2 + photo.width, 585], outline=(184, 173, 190))
    return og


def main():
    card = photograph_card()
    card.save(OUT / "invitation-card.jpg", quality=90, optimize=True)
    link_preview(card).save(OUT / "og-reception.jpg", quality=86, optimize=True)
    print(f"render-card: invitation-card.jpg {card.size[0]}x{card.size[1]} and og-reception.jpg redrawn from reception.html")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:   # the hook shows this and stops the commit
        print(f"render-card: {error}", file=sys.stderr)
        sys.exit(1)
