"""Feed algorithm services — 3-level random feed pipeline.

Level 1 (level1_pool.py):     PostFeedMeta index — what posts can appear in feeds.
Level 2 (level2_intake.py):   Publish intake — duplicate check + bucket placement.
Level 3 (level3_personal.py): Per-user shuffled snapshot from the eligible pool.
common.py:                    Shared hashing helpers and tunable constants.

See docs/ALGORITHM.md for the full specification.
"""
