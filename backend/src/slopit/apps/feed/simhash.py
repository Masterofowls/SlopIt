from __future__ import annotations

import hashlib
import struct

NEAR_DUPLICATE_THRESHOLD = 4


def _feature_hash(feature: str) -> int:
    digest = hashlib.md5(feature.encode(), usedforsecurity=False).digest()
    return struct.unpack(">Q", digest[:8])[0]


def compute(text: str) -> str:
    if text is None or text.strip() == "":
        return "0" * 16

    tokens = text.lower().split()
    features = list(tokens)
    for i in range(len(tokens) - 1):
        features.append(tokens[i] + " " + tokens[i + 1])

    v = [0] * 64
    for feat in features:
        h = _feature_hash(feat)
        for i in range(64):
            if (h >> i) & 1:
                v[i] += 1
            else:
                v[i] -= 1

    fingerprint = 0
    for i in range(64):
        if v[i] > 0:
            fingerprint |= 1 << i

    return format(fingerprint, "016x")


def hamming_distance(hash_a: str, hash_b: str) -> int:
    xor = int(hash_a, 16) ^ int(hash_b, 16)
    count = 0
    for i in range(64):
        if (xor >> i) & 1:
            count += 1
    return count


def is_near_duplicate(hash_a: str, hash_b: str) -> bool:
    return hamming_distance(hash_a, hash_b) < NEAR_DUPLICATE_THRESHOLD
