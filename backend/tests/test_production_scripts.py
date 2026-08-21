"""Destructive seed/wipe scripts must refuse production."""

import pytest

from scripts.reset_chapter_data import reset_chapter_data
from scripts.seed_demo_data import seed_demo_data
from scripts.seed_walkthrough_data import seed_walkthrough_data


def test_reset_chapter_data_refuses_production(monkeypatch):
    monkeypatch.setattr("scripts.reset_chapter_data.settings.ENVIRONMENT", "production")
    with pytest.raises(SystemExit, match="Refusing to wipe production"):
        reset_chapter_data(yes=True)


def test_seed_demo_data_refuses_production(monkeypatch):
    monkeypatch.setattr("scripts.seed_demo_data.settings.ENVIRONMENT", "production")
    with pytest.raises(SystemExit, match="Refusing to seed demo data in production"):
        seed_demo_data()


def test_seed_walkthrough_data_refuses_production(monkeypatch):
    monkeypatch.setattr(
        "scripts.seed_walkthrough_data.settings.ENVIRONMENT", "production"
    )
    with pytest.raises(
        SystemExit, match="Refusing to seed walkthrough data in production"
    ):
        seed_walkthrough_data()
