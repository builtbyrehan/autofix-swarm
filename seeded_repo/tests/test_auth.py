import unittest

import _bootstrap  # noqa: F401
from autofix_seed.auth import can_refund


class RefundAuthorizationTests(unittest.TestCase):
    def test_administrator_can_refund_an_order_owned_by_someone_else(self) -> None:
        self.assertTrue(can_refund("customer-1", "admin-1", "admin"))


if __name__ == "__main__":
    unittest.main()
