from datetime import date

from app.services.minutes_grounding import (
    ground_action_item,
    ground_deadline,
    ground_decision,
    ground_summary,
)

NOVEMBER_MEETING = date(2026, 11, 20)
DECEMBER_MEETING = date(2026, 12, 15)


def test_november_26_uses_the_2026_meeting_year():
    notes = "The treasurer will prepare an expense breakdown by November 26."
    due = ground_deadline(
        notes=notes,
        evidence="prepare an expense breakdown by November 26",
        model_due="2024-11-26",
        meeting=NOVEMBER_MEETING,
    )

    assert due == "2026-11-26"


def test_december_meeting_rolls_january_deadline_into_the_next_year():
    notes = "The treasurer will submit receipts by January 8."
    due = ground_deadline(
        notes=notes,
        evidence="submit receipts by January 8",
        model_due="2026-01-08",
        meeting=DECEMBER_MEETING,
    )

    assert due == "2027-01-08"


def test_explicit_year_in_the_notes_is_preserved():
    notes = "File the annual report by November 26, 2027."
    due = ground_deadline(
        notes=notes,
        evidence="File the annual report by November 26, 2027",
        model_due="2026-11-26",
        meeting=NOVEMBER_MEETING,
    )

    assert due == "2027-11-26"


def test_ambiguous_deadlines_stay_empty():
    notes = "The treasurer will send the breakdown soon, or by the 26th."
    assert (
        ground_deadline(
            notes=notes,
            evidence="send the breakdown soon, or by the 26th",
            model_due="2026-11-26",
            meeting=NOVEMBER_MEETING,
        )
        is None
    )
    assert (
        ground_deadline(
            notes="Finish it next meeting.",
            evidence="Finish it next meeting",
            model_due="next meeting",
            meeting=NOVEMBER_MEETING,
        )
        is None
    )
    assert (
        ground_deadline(
            notes="Choose November 26 or January 8.",
            evidence="Choose November 26 or January 8",
            model_due=None,
            meeting=NOVEMBER_MEETING,
        )
        is None
    )


def test_discussion_and_tentative_proposal_are_not_decisions():
    notes = "The board discussed collecting member feedback."
    assert (
        ground_decision(
            notes,
            "The board approved collecting member feedback.",
            "the board discussed collecting member feedback",
        )
        is None
    )
    proposal = "Sapan tentatively proposed a spring retreat."
    assert (
        ground_decision(proposal, "Approved a spring retreat.", proposal) is None
    )


def test_confirmed_financial_approval_stays_when_the_notes_state_it():
    notes = "The board approved $500 for cultural night."
    assert (
        ground_decision(
            notes,
            "The board approved $500 for cultural night.",
            "approved $500 for cultural night",
        )
        == "The board approved $500 for cultural night."
    )
    assert (
        ground_decision(
            notes,
            "The board approved $900 for cultural night.",
            "approved $500 for cultural night",
        )
        is None
    )


def test_missing_owner_and_deadline_stay_empty():
    notes = "Someone should email the campus calendar."
    item = ground_action_item(
        notes=notes,
        task="Email the campus calendar",
        owner="Events chair",
        due="2024-12-01",
        evidence="email the campus calendar",
        meeting=NOVEMBER_MEETING,
    )

    assert item == {
        "task": "Email the campus calendar",
        "owner": None,
        "due": None,
    }


def test_negative_and_postponed_approvals_are_not_decisions():
    cases = [
        "The board did not approve the proposed budget.",
        "Approval was postponed until the next meeting.",
        "The president proposed spending $350, but no vote occurred.",
        "The board discussed whether to approve the proposal.",
    ]
    for notes in cases:
        assert ground_decision(notes, "The board approved the budget.", notes) is None
        summary = ground_summary("The board approved the budget.", notes)
        assert summary == (
            "The notes record the board's discussion. "
            "They do not record an approved decision."
        )
    postponed = "Approval was postponed until the next meeting."
    assert ground_decision(postponed, "Approved the budget.", "Approval was") is None


def test_confirmed_food_approval_and_november_follow_up_stay():
    approval = "The board approved $350 for food and decorations."
    assert (
        ground_decision(approval, approval, "approved $350 for food and decorations")
        == approval
    )

    notes = "The treasurer will prepare the expense breakdown by November 26."
    item = ground_action_item(
        notes=notes,
        task="Prepare the expense breakdown",
        owner="Treasurer",
        due="2024-11-26",
        evidence="will prepare the expense breakdown by November 26",
        meeting=NOVEMBER_MEETING,
    )
    assert item == {
        "task": "Prepare the expense breakdown",
        "owner": "Treasurer",
        "due": "2026-11-26",
    }


def test_a_discussion_is_not_an_action_item():
    notes = "The board discussed collecting member feedback."
    assert (
        ground_action_item(
            notes=notes,
            task="Collect member feedback",
            owner="Secretary",
            due=None,
            evidence="discussed collecting member feedback",
            meeting=NOVEMBER_MEETING,
        )
        is None
    )


def test_distant_month_and_day_stay_empty():
    notes = "The treasurer will send the file by March 3."
    assert (
        ground_deadline(
            notes=notes,
            evidence="send the file by March 3",
            model_due="2027-03-03",
            meeting=NOVEMBER_MEETING,
        )
        is None
    )
    september = "Finish the draft by September 20."
    assert (
        ground_deadline(
            notes=september,
            evidence="Finish the draft by September 20",
            model_due="2027-09-20",
            meeting=NOVEMBER_MEETING,
        )
        is None
    )


def test_recent_past_month_and_day_uses_the_meeting_year():
    notes = "The treasurer will file the form dated October 1."
    assert (
        ground_deadline(
            notes=notes,
            evidence="file the form dated October 1",
            model_due="2024-10-01",
            meeting=NOVEMBER_MEETING,
        )
        == "2026-10-01"
    )


def test_summary_does_not_turn_a_discussion_into_an_approval():
    summary = ground_summary(
        "The board discussed member feedback.\n\nThe board approved a new fee.",
        "The board discussed collecting member feedback.",
    )

    assert "approved" not in summary.casefold()
    assert "discussed member feedback" in summary.casefold()
