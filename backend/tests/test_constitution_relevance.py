"""Constitution relevance keeps topical passages below the cosine floor."""

from app.services.ai_chat_service import (
    _relevant_constitution_hits,
    _relevant_hits,
)
from app.services.constitution_relevance import (
    constitution_chunk_retained,
    shares_constitutional_term,
)
from app.services.constitution_search_service import ConstitutionSearchHit
from app.services.org_document_service import OrgDocumentSearchHit

MINIMUM = 0.45


def _kept(question: str, content: str, score: float) -> bool:
    return constitution_chunk_retained(
        question=question,
        content=content,
        similarity=score,
        minimum=MINIMUM,
    )


def test_voting_passage_below_threshold_is_retained():
    question = "What does the constitution say about voting?"
    assert _kept(question, "In order to vote, you must be physically present.", 0.335)
    assert not _kept(question, "The cultural night is on Friday.", 0.335)


def test_amendment_passage_below_threshold_is_retained():
    question = "How are amendments to the constitution adopted?"
    assert _kept(
        question,
        "Amendments to this constitution may be proposed by any voting member.",
        0.352,
    )
    assert not _kept(question, "Hazing in any form is prohibited.", 0.235)


def test_membership_eligibility_passage_below_threshold_is_retained():
    question = "Who is eligible for membership?"
    assert _kept(
        question,
        "Eligibility: Membership shall be open to all students.",
        0.392,
    )
    assert not _kept(question, "The hazing policy applies to members and guests.", 0.386)


def test_officer_duties_below_threshold_are_retained():
    question = "What are the duties of the officers?"
    assert _kept(question, "Duties of the Event Manager and other officers.", 0.441)
    assert _kept(question, "Duties of the President.", 0.511)


def test_mixed_dues_question_keeps_dues_and_drops_unrelated_text():
    question = "What is the treasury balance, and what does the constitution say about dues?"
    assert _kept(question, "Active membership requires payment of dues.", 0.222)
    assert not _kept(
        question,
        "The vice president provides clarification on Association matters.",
        0.329,
    )


def test_upcoming_events_question_drops_constitution_text_below_threshold():
    question = "What events are coming up?"
    assert not _kept(
        question,
        "Duties of the Event Manager: officers plan events and activities.",
        0.345,
    )


def test_treasury_balance_question_drops_officer_text_below_threshold():
    question = "What is our treasury balance?"
    assert not _kept(
        question,
        "Duties of the Treasurer: officers receive financial reports.",
        0.230,
    )


def test_ballot_counting_question_keeps_ballot_passage_below_threshold():
    question = "Who counts the ballots?"
    assert _kept(
        question,
        "Elections shall be decided by secret ballot and counted by two officers.",
        0.310,
    )


def test_accidental_substrings_do_not_count_as_constitutional_terms():
    assert not shares_constitutional_term(
        "Explain devotion in the preamble.",
        "Devotion appears in the preamble.",
    )
    assert not shares_constitutional_term(
        "Who works in the office?",
        "The office schedule is posted.",
    )
    assert not shares_constitutional_term("What is a pivot?", "A pivot is a point.")
    assert not _kept("Explain devotion in the preamble.", "Devotion appears here.", 0.40)
    assert _kept("Who counts the ballots?", "The ballots are counted immediately.", 0.20)
    assert shares_constitutional_term("Who may vote?", "Candidates are allowed to vote.")
    assert shares_constitutional_term(
        "Who is eligible for membership?",
        "Eligibility is defined in this section.",
    )


def test_question_with_no_recognized_term_uses_similarity_only():
    question = "When is the next meeting?"
    content = "Regular monthly meetings are held during the semester."
    assert not _kept(question, content, 0.40)
    assert _kept(question, content, 0.45)
    assert not shares_constitutional_term(question, "Officers count the ballots.")


def test_blank_constitution_chunk_is_dropped_even_with_a_shared_term():
    assert not _kept("Who may vote?", "   ", 0.90)


def test_document_filter_ignores_constitutional_terms():
    hits = [
        OrgDocumentSearchHit(
            1,
            1,
            "Handbook",
            "public",
            0,
            "Dues",
            "Members pay semester dues.",
            0.222,
        )
    ]
    assert _relevant_hits(hits, MINIMUM) == []


def test_constitution_filter_keeps_shared_term_below_similarity_floor():
    hits = [
        ConstitutionSearchHit(1, 0, "Dues", "Members pay semester dues.", 0.222),
        ConstitutionSearchHit(2, 1, "Other", "Unrelated nearest neighbor.", 0.329),
    ]
    kept = _relevant_constitution_hits(
        hits,
        MINIMUM,
        "What is the treasury balance, and what does the constitution say about dues?",
    )
    assert [hit.id for hit in kept] == [1]
