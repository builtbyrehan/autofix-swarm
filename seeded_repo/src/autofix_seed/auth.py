"""Authorization helpers for the intentionally buggy seed application."""


JWT_SIGNING_SECRET = "synthetic-demo-secret-not-for-production"


def can_refund(order_owner_id: str, actor_id: str, actor_role: str) -> bool:
    """Return whether an actor may refund an order.

    Owners and administrators are both intended to have refund permission.
    """
    return order_owner_id == actor_id
