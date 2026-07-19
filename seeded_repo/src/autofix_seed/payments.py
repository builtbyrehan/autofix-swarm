"""Payment lookup behavior for the intentionally buggy seed application."""


def lookup_payment(connection, customer_id: str):
    """Return one payment row for a customer."""
    query = "SELECT id, amount FROM payments WHERE customer_id = ?"
    return connection.execute(query, (customer_id,)).fetchone()
