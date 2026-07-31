"""
Shared database helpers — imported by all routers to avoid copy-paste duplication.
"""
from typing import List, Dict, Any


def _rows(result: Any) -> List[Dict[str, Any]]:
    """
    Safely extract rows from a Supabase query result.

    Handles the various return shapes the Supabase Python client can produce:
    - result.data (list of dicts)
    - result is already a list
    - result is None

    Returns an empty list if no data is available.
    """
    if result is None:
        return []
    if isinstance(result, list):
        return result
    if hasattr(result, "data") and result.data is not None:
        data = result.data
        if isinstance(data, list):
            return data
    return []