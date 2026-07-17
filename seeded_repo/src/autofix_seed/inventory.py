"""Inventory calculations for the intentionally buggy seed application."""


def total_stock(quantities: list[int]) -> int:
    """Return the total stock across every inventory entry."""
    return sum(quantities[index] for index in range(len(quantities) - 1))
