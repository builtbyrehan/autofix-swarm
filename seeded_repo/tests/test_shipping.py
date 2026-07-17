import unittest

import _bootstrap  # noqa: F401
from autofix_seed.shipping import format_shipping_label, shipping_cost


class ShippingTests(unittest.TestCase):
    def test_threshold_itself_receives_free_shipping(self) -> None:
        self.assertEqual(shipping_cost(50.0), 0.0)

    def test_country_is_trimmed_and_normalized(self) -> None:
        self.assertEqual(format_shipping_label(" Lahore ", " pk "), "Lahore, PK")


if __name__ == "__main__":
    unittest.main()
