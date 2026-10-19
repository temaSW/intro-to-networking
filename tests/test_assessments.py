"""Publication and coverage regressions; teacher data must not be required in a clone."""

from copy import deepcopy
import importlib.util
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("assessment_check", ROOT / "scripts/check_assessments.py")
assessment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assessment)


def bank_copy():
    return deepcopy(assessment.load(assessment.BANK))


def test_public_bank_matches_existing_topic_catalogue():
    bank = bank_copy()
    assert {t["id"] for t in bank["topics"]} == {"00", "01", "02", "03", "04", "05"}
    assert len(assessment.validate(bank)) == 150
    assessment.check_exports(bank)


@pytest.mark.parametrize("mutation", ["count", "duplicate", "teacher", "path", "section", "coverage", "difficulty"])
def test_rejects_broken_assessment_or_publication_contract(mutation):
    bank = bank_copy()
    topic = bank["topics"][0]
    q = topic["questions"][0]
    if mutation == "count":
        topic["questions"].pop()
    elif mutation == "duplicate":
        topic["questions"][1]["id"] = q["id"]
    elif mutation == "teacher":
        q["source"]["expected_answer"] = "Private content nested inside public source metadata"
    elif mutation == "path":
        q["source"]["path"] = "../outside.qmd"
    elif mutation == "section":
        q["source"]["section"] = "A section that is absent from the source"
    elif mutation == "coverage":
        topic["learning_outcomes"]["T00-LO99"] = "New outcome without assessment coverage"
    elif mutation == "difficulty":
        q["difficulty"] = "unknown"
    with pytest.raises(AssertionError):
        assessment.validate(bank)


def test_local_key_is_explicitly_required_when_validating_teacher():
    with pytest.raises(KeyError):
        assessment.validate(bank_copy(), {"items": {}})


def test_source_links_target_specific_sections_and_explicit_anchors():
    bank = bank_copy()
    link = assessment.source_link(bank["topics"][1]["questions"][0])
    assert link.endswith("01-baseband-signal.qmd#sampling)")
    assert "#как-длительность-бита-влияет-на-спектр)" in assessment.source_link(bank["topics"][2]["questions"][0])
