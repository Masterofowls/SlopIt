#!/usr/bin/env python3
"""Generate PNG assets for Open Graph previews and PWA icons."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
ICONS_DIR = PUBLIC / "icons"

BG = (6, 19, 12)
ACCENT = (57, 255, 20)
TEXT = (215, 255, 227)
MUTED = (159, 217, 176)
BORDER = (125, 255, 154)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def draw_brand_card(draw: ImageDraw.ImageDraw, width: int, height: int) -> None:
    pad = max(36, width // 28)
    draw.rounded_rectangle(
        (pad, pad, width - pad, height - pad),
        radius=max(20, width // 40),
        outline=BORDER,
        width=max(2, width // 400),
        fill=(255, 255, 255, 10),
    )

    title_font = _font(max(48, width // 14), bold=True)
    subtitle_font = _font(max(22, width // 34), bold=True)
    body_font = _font(max(16, width // 48))

    draw.text((pad * 2, pad * 2), "SlopIt", font=title_font, fill=ACCENT)
    draw.text(
        (pad * 2, pad * 2 + max(56, height // 10)),
        "Social feed for memes, posts & reactions",
        font=subtitle_font,
        fill=TEXT,
    )
    draw.text(
        (pad * 2, pad * 2 + max(96, height // 6)),
        "Browse trending slop. Post. React. Repeat.",
        font=body_font,
        fill=MUTED,
    )

    badge_r = max(36, min(width, height) // 12)
    cx = width - pad * 2 - badge_r
    cy = pad * 2 + badge_r
    draw.ellipse(
        (cx - badge_r, cy - badge_r, cx + badge_r, cy + badge_r),
        outline=ACCENT,
        width=max(3, width // 400),
        fill=(57, 255, 20, 28),
    )
    draw.text((cx - badge_r // 3, cy - badge_r // 2), ":3", font=title_font, fill=ACCENT)


def render_og_image() -> None:
    width, height = 1200, 630
    img = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(img)
    draw_brand_card(draw, width, height)
    img.save(PUBLIC / "og-image.png", format="PNG", optimize=True)
    print(f"wrote {PUBLIC / 'og-image.png'}")


def render_icon(size: int, name: str) -> None:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    pad = size // 8
    draw.rounded_rectangle(
        (pad, pad, size - pad, size - pad),
        radius=size // 6,
        outline=BORDER,
        width=max(2, size // 128),
        fill=(11, 42, 24),
    )
    font = _font(max(24, size // 4), bold=True)
    text = "S"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - tw) / 2, (size - th) / 2 - size // 32),
        text,
        font=font,
        fill=ACCENT,
    )
    img.save(ICONS_DIR / name, format="PNG", optimize=True)
    print(f"wrote {ICONS_DIR / name}")


def main() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    render_og_image()
    render_icon(192, "icon-192.png")
    render_icon(512, "icon-512.png")
    render_icon(180, "apple-touch-icon.png")


if __name__ == "__main__":
    main()
