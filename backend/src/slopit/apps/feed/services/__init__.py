"""Feed algorithm services — 3-level random feed pipeline.

Level 1 (level1_pool.py):    System feed pool — PostFeedMeta index build & maintenance.
Level 2 (level2_intake.py):  New-content intake — anti-spam, anti-dup, bucket assignment.
Level 3 (level3_personal.py):Per-user snapshot generation with seed-based shuffle.

See docs/ALGORITHM.md for the full specification.
"""
