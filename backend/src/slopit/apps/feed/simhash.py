"""64-bit SimHash for near-duplicate post detection.

Two fingerprints with Hamming distance < NEAR_DUPLICATE_THRESHOLD bits
are considered near-duplicates and flagged by the L2 intake service.

Algorithm (Charikar 2002):
1. Tokenise text into unigrams + bigram shingles.
2. For each token, compute a 64-bit hash.
3. Accumulate: v[i] += 1 if bit i is set, else v[i] -= 1.
4. Fingerprint: bit i = 1 if v[i] > 0, else 0.
"""

from __future__ import annotations

import hashlib
import struct

NEAR_DUPLICATE_THRESHOLD = 4


def _feature_hash(feature: str) -> int:
    """Return a stable 64-bit unsigned integer for a feature token."""
    digest = hashlib.md5(feature.encode(), usedforsecurity=False).digest()
    return struct.unpack(">Q", digest[:8])[0]


def compute(text: str) -> str:
    """Return a 16-char hex SimHash fingerprint for *text*.

    Returns the zero fingerprint for empty/whitespace-only input.
    """
    if not text or not text.strip():
        return "0" * 16

    tokens = text.lower().split()
    features: list[str] = tokens + [tokens[i] + " " + tokens[i + 1] for i in range(len(tokens) - 1)]

    v: list[int] = [0] * 64
    for feat in features:
        h = _feature_hash(feat)
        for i in range(64):
            v[i] += 1 if (h >> i) & 1 else -1

    fingerprint = 0
    for i in range(64):
        if v[i] > 0:
            fingerprint |= 1 << i

    return format(fingerprint, "016x")


def hamming_distance(hash_a: str, hash_b: str) -> int:
    """Hamming distance between two 16-char hex SimHash strings."""
    xor = int(hash_a, 16) ^ int(hash_b, 16)
    count = 0
    while xor:
        xor &= xor - 1
        count += 1
    return count


def is_near_duplicate(hash_a: str, hash_b: str) -> bool:
    """Return True if two SimHashes are within NEAR_DUPLICATE_THRESHOLD bits."""
    return hamming_distance(hash_a, hash_b) < NEAR_DUPLICATE_THRESHOLD
