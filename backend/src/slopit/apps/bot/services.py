from __future__ import annotations

import json
import urllib.request
from typing import Any


def fetch_api_status(status_url: str, timeout_seconds: int = 5) -> dict[str, Any]:
    with urllib.request.urlopen(status_url, timeout=timeout_seconds) as resp:  
        return json.loads(resp.read().decode())
