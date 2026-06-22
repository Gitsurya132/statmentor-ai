from __future__ import annotations

from app.schemas.research_question import (
    ResearchDesignCreate,
    StudyFocus,
    StudyType,
    TemporalDesign,
)
from app.services.research_design import generate_research_design_summary


def test_generate_research_design_summary() -> None:
    data = ResearchDesignCreate(
        study_type=StudyType.QUANTITATIVE,
        research_questions=["How are the constructs related?"],
        hypotheses=["Leadership is positively related to performance."],
        sample_size=250,
        temporal_design=TemporalDesign.CROSS_SECTIONAL,
        study_focus=StudyFocus.RELATIONSHIP,
        software_preference="Python",
        key_constructs=[
            "transformational leadership",
            "organizational culture",
            "employee engagement",
            "organizational performance",
        ],
    )

    summary = generate_research_design_summary(data)

    assert summary == (
        "You are conducting a cross-sectional quantitative study examining the "
        "relationship between transformational leadership, organizational culture, "
        "employee engagement, and organizational performance."
    )

