"""Local deterministic avatar generation — no external services."""

import base64
import hashlib


def generate_avatar_data_url(seed: str) -> str:
    """Return an inline SVG data URL with a coloured circle and initial letter.

    Deterministic: same seed → same colour and letter every time.
    No network calls, no dependencies beyond the stdlib.
    """
    clean = seed.strip() if seed else "?"
    letter = clean[0].upper() if clean else "?"

    # Pick hue from MD5 hash so every username gets a unique-ish colour.
    h = int(hashlib.md5(clean.encode("utf-8")).hexdigest(), 16)
    hue = h % 360
    bg = f"hsl({hue},55%,42%)"

    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">'
        f'<circle cx="20" cy="20" r="20" fill="{bg}"/>'
        '<text x="20" y="27" text-anchor="middle" '
        'font-family="Arial,sans-serif" font-size="19" '
        f'font-weight="bold" fill="#fff">{letter}</text>'
        "</svg>"
    )

    encoded = base64.b64encode(svg.encode("utf-8")).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"
