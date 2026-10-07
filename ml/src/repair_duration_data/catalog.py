"""Catalog label/identity semantics shared by offline and runtime paths."""

from __future__ import annotations


def normalize_catalog_service_label(raw_name: object) -> str:
    """Preserve training representation, trimming only surrounding whitespace."""
    if not isinstance(raw_name, str):
        raise ValueError("Catalog service name must be a string")
    label = raw_name.strip()
    if not label:
        raise ValueError("Catalog service name must not be blank")
    return label


def internal_catalog_identity(catalog_id: object) -> int:
    """Return stable DB identity used only by exact-catalog history."""
    if isinstance(catalog_id, bool):
        raise ValueError("Catalog ID must be a positive integer")
    try:
        identity = int(catalog_id)
    except (TypeError, ValueError) as exc:
        raise ValueError("Catalog ID must be a positive integer") from exc
    if identity <= 0:
        raise ValueError("Catalog ID must be a positive integer")
    return identity
