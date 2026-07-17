import unittest

import _bootstrap  # noqa: F401
from autofix_seed.inventory import total_stock


class InventoryTests(unittest.TestCase):
    def test_total_stock_includes_the_final_entry(self) -> None:
        self.assertEqual(total_stock([4, 5, 6]), 15)


if __name__ == "__main__":
    unittest.main()
