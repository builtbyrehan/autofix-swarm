from pathlib import Path
import unittest

from eval.run_eval import load_json, score, validate_ground_truth


GROUND_TRUTH_PATH = Path(__file__).resolve().parents[1] / "seeded_bugs.json"


class EvaluationHarnessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.ground_truth = validate_ground_truth(load_json(GROUND_TRUTH_PATH))

    def test_seeded_ground_truth_contains_seven_unique_bugs(self) -> None:
        self.assertEqual(len(self.ground_truth), 7)
        self.assertEqual(len({bug["id"] for bug in self.ground_truth}), 7)

    def test_perfect_detection_and_verification_scores_one(self) -> None:
        issues = [
            {
                "id": f"issue-{index}",
                "file": bug["file"],
                "line_range": bug["line_range"],
            }
            for index, bug in enumerate(self.ground_truth, start=1)
        ]
        verdicts = [
            {
                "issue_id": issue["id"],
                "tests_passed": True,
            }
            for issue in issues
        ]

        result = score(self.ground_truth, issues, verdicts)

        self.assertEqual(result["bugs_found"], 7)
        self.assertEqual(result["detection_rate"], 1.0)
        self.assertEqual(result["fix_success_rate"], 1.0)
        self.assertEqual(result["false_positive_count"], 0)

    def test_one_detection_cannot_match_two_ground_truth_records(self) -> None:
        overlapping_issue = {
            "id": "one-issue",
            "file": "src/autofix_seed/auth.py",
            "line_range": {"start": 1, "end": 20},
        }

        result = score(self.ground_truth, [overlapping_issue], [])

        self.assertEqual(result["bugs_found"], 1)
        self.assertEqual(len(result["matched_issues"]), 1)


if __name__ == "__main__":
    unittest.main()
