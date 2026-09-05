"""Exercise the user-facing source configuration and initial inventory commands."""
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

from concord.runtime.cli import main, initialize, normalize_source, create_source, ConfigurationError


class SourceSetupTests(unittest.TestCase):
    def test_catalog_and_file_inventory_do_not_start_sync_or_print_content(self):
        with tempfile.TemporaryDirectory() as directory:
            config = initialize(Path(directory) / "workspace")
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                result = main(["scan", "--config", str(config)])
            self.assertEqual(result, 0)
            inventory = json.loads(output.getvalue())
            self.assertTrue(inventory["complete"])
            self.assertEqual(len(inventory["documents"]), 2)
            self.assertNotIn("content", inventory["documents"][0])
            self.assertFalse((config.parent / "state/concord.sqlite3").exists())
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            self.assertEqual(main(["catalog"]), 0)
        kinds = {s["type"] for s in json.loads(output.getvalue())["sources"]}
        self.assertTrue({"confluence_cloud", "jira_cloud", "filesystem", "json_http"} <= kinds)

    def test_atlassian_configuration_dispatch_and_secret_boundary(self):
        config = {"type": "confluence_cloud", "base_url": "https://api.atlassian.com/ex/confluence/cloud-example", "space_ids": ["42"], "token_env": "CONCORD_TEST_MISSING_OAUTH"}
        normalized = normalize_source(config, Path("/tmp"))
        source = create_source(normalized)
        self.assertEqual(source.space_ids, ["42"])
        self.assertFalse(source.scan().complete)
        with self.assertRaises(ConfigurationError):
            normalize_source(config | {"access_token": "do-not-accept-secret-values"}, Path("/tmp"))
        with self.assertRaises(ConfigurationError):
            normalize_source(config | {"base_url": "https://untrusted.example/ex/confluence/cloud-example"}, Path("/tmp"))


if __name__ == "__main__":
    unittest.main()
