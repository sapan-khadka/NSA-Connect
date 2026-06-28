from app.prompts.meeting_minutes import (
    MEETING_MINUTES_SYSTEM_PROMPT,
    build_meeting_minutes_user_prompt,
)


def test_system_prompt_defines_minutes_output_contract():
    assert "NSA Connect" in MEETING_MINUTES_SYSTEM_PROMPT
    assert '"summary"' in MEETING_MINUTES_SYSTEM_PROMPT
    assert '"key_decisions"' in MEETING_MINUTES_SYSTEM_PROMPT
    assert '"action_items"' in MEETING_MINUTES_SYSTEM_PROMPT
    assert "Return ONLY valid JSON" in MEETING_MINUTES_SYSTEM_PROMPT


def test_build_meeting_minutes_user_prompt_includes_raw_notes():
    prompt = build_meeting_minutes_user_prompt(
        notes="- dashain in oct\n- sapan reserve room",
    )

    assert "Raw notes:" in prompt
    assert "sapan reserve room" in prompt
    assert "Return the structured minutes JSON only." in prompt


def test_build_meeting_minutes_user_prompt_includes_meeting_title():
    prompt = build_meeting_minutes_user_prompt(
        notes="budget review",
        meeting_title="March Board Meeting",
    )

    assert "Meeting title: March Board Meeting" in prompt
