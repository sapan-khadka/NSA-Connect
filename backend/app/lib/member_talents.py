from enum import StrEnum


class MemberTalent(StrEnum):
    DANCING = "dancing"
    SINGING = "singing"
    INSTRUMENTS = "instruments"
    ACTING_DRAMA = "acting_drama"
    HOSTING_MC = "hosting_mc"
    POETRY_WRITING = "poetry_writing"
    COOKING = "cooking"
    PHOTOGRAPHY_VIDEOGRAPHY = "photography_videography"
    DECORATION_ART = "decoration_art"
    MODELING = "modeling"
    OTHER = "other"


MEMBER_TALENT_LABELS: dict[MemberTalent, str] = {
    MemberTalent.DANCING: "Dancing",
    MemberTalent.SINGING: "Singing",
    MemberTalent.INSTRUMENTS: "Instruments (Madal/Tabla/etc.)",
    MemberTalent.ACTING_DRAMA: "Acting/Drama",
    MemberTalent.HOSTING_MC: "Hosting/MC",
    MemberTalent.POETRY_WRITING: "Poetry/Writing",
    MemberTalent.COOKING: "Cooking",
    MemberTalent.PHOTOGRAPHY_VIDEOGRAPHY: "Photography/Videography",
    MemberTalent.DECORATION_ART: "Decoration/Art",
    MemberTalent.MODELING: "Modeling",
    MemberTalent.OTHER: "Other",
}

ALL_MEMBER_TALENTS = list(MemberTalent)


def is_valid_talent(value: str) -> bool:
    try:
        MemberTalent(value)
        return True
    except ValueError:
        return False
