from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import _bootstrap  # noqa: F401
from autofix_seed.config import ConfigError, load_config


class ConfigTests(unittest.TestCase):
    def test_invalid_json_raises_domain_specific_error(self) -> None:
        with TemporaryDirectory() as temporary_directory:
            config_path = Path(temporary_directory) / "config.json"
            config_path.write_text("{not-json", encoding="utf-8")

            with self.assertRaises(ConfigError):
                load_config(config_path)


if __name__ == "__main__":
    unittest.main()
