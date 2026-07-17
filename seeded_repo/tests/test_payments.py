import unittest

import _bootstrap  # noqa: F401
from autofix_seed.payments import lookup_payment


class RecordingConnection:
    def __init__(self) -> None:
        self.calls: list[tuple] = []

    def execute(self, *args):
        self.calls.append(args)
        return self

    def fetchone(self):
        return {"id": "payment-1", "amount": 25.0}


class PaymentLookupTests(unittest.TestCase):
    def test_customer_id_is_bound_as_a_parameter(self) -> None:
        connection = RecordingConnection()
        hostile_id = "customer' OR 1=1 --"

        lookup_payment(connection, hostile_id)

        self.assertEqual(
            connection.calls,
            [
                (
                    "SELECT id, amount FROM payments WHERE customer_id = ?",
                    (hostile_id,),
                )
            ],
        )


if __name__ == "__main__":
    unittest.main()
