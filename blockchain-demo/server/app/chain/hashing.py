"""Deterministic hashing of structured data."""
import json
from typing import Any

from eth_utils import keccak


def canonical(obj: Any) -> str:
    """Stable JSON text: sorted keys, no spaces, so every node hashes identically."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


def digest_text(text: str) -> str:
    return "0x" + keccak(text=text).hex()


def digest(obj: Any) -> str:
    return digest_text(canonical(obj))
