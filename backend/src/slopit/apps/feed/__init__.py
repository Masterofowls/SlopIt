"""Feed app — flagship 3-level random algorithm. See docs/ALGORITHM.md.

Stage 3 will fill: PostFeedMeta, FeedSnapshot, FeedPreferences models +
services/level1_pool.py, level2_intake.py, level3_personal.py + RQ jobs.
"""

default_app_config = "apps.feed.apps.FeedConfig"
