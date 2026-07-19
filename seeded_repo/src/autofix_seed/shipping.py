"""Shipping rules for the intentionally buggy seed application."""


def shipping_cost(subtotal: float, free_shipping_threshold: float = 50.0) -> float:
    """Return zero at or above the free-shipping threshold."""
    if subtotal >= free_shipping_threshold:
        return 0.0
    return 8.99


def format_shipping_label(city: str, country: str) -> str:
    """Return a consistently normalized city and country label."""
    normalized_country = country.strip().upper()
    return f"{city.strip()}, {normalized_country}"
