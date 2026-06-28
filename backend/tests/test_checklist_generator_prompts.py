from app.models.event import EventType
from app.prompts.checklist_generator import (
    CHECKLIST_GENERATOR_SYSTEM_PROMPT,
    EVENT_TYPE_GUIDANCE,
    build_checklist_user_prompt,
)


def test_system_prompt_defines_role_and_output_contract():
    assert "NSA Connect" in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "Nepalese Students' Association" in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert '"categories"' in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "Return ONLY valid JSON" in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "no markdown fences" in CHECKLIST_GENERATOR_SYSTEM_PROMPT


def test_system_prompt_covers_all_event_types():
    for event_type in EventType:
        assert f"**{event_type.value}**" in CHECKLIST_GENERATOR_SYSTEM_PROMPT


def test_system_prompt_includes_task_quality_rules():
    assert "starts with a strong verb" in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "Do not repeat the same action" in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "10–15 tasks total" in CHECKLIST_GENERATOR_SYSTEM_PROMPT
    assert "120 characters" in CHECKLIST_GENERATOR_SYSTEM_PROMPT


def test_event_type_guidance_covers_every_event_type():
    assert set(EVENT_TYPE_GUIDANCE) == set(EventType)


def test_build_checklist_user_prompt_includes_event_context():
    prompt = build_checklist_user_prompt(
        event_name="Dashain Celebration",
        event_type=EventType.CULTURAL,
        tasks=[],
    )

    assert "Event name: Dashain Celebration" in prompt
    assert "Event type: cultural" in prompt
    assert EVENT_TYPE_GUIDANCE[EventType.CULTURAL] in prompt
    assert "Return the checklist JSON only." in prompt


def test_build_checklist_user_prompt_lists_seed_tasks():
    prompt = build_checklist_user_prompt(
        event_name="General Meeting",
        event_type=EventType.MEETING,
        tasks=["Draft agenda", "Book room"],
    )

    assert "Seed tasks from the board" in prompt
    assert "- Draft agenda" in prompt
    assert "- Book room" in prompt


def test_build_checklist_user_prompt_omits_seed_section_when_empty():
    prompt = build_checklist_user_prompt(
        event_name="Spring Social",
        event_type=EventType.SOCIAL,
        tasks=[],
    )

    assert "Seed tasks from the board" not in prompt
