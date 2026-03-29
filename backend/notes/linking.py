import math
import re

from .models import Note, NoteLink

AUTO_LINK_RELATIONSHIP = "semantic related"
AUTO_LINK_THRESHOLD = 0.08

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "with",
}


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9']+", (text or "").lower())
    # Keep 2+ character acronyms like "ai", "ml", "dl" for better matching.
    return {token for token in tokens if len(token) >= 2 and token not in STOP_WORDS}


def _cosine_overlap(tokens_a: set[str], tokens_b: set[str]) -> float:
    if not tokens_a or not tokens_b:
        return 0.0
    overlap = len(tokens_a.intersection(tokens_b))
    return overlap / math.sqrt(len(tokens_a) * len(tokens_b))


def refresh_ai_links_for_note(note: Note, min_score: float = AUTO_LINK_THRESHOLD) -> None:
    """Refresh AI-generated semantic links for a note against user's other notes."""

    NoteLink.objects.filter(
        is_ai_generated=True,
        relationship_type=AUTO_LINK_RELATIONSHIP,
        source_note=note,
    ).delete()
    NoteLink.objects.filter(
        is_ai_generated=True,
        relationship_type=AUTO_LINK_RELATIONSHIP,
        target_note=note,
    ).delete()

    if note.is_deleted:
        return

    note_tokens = _tokenize(f"{note.title}\n{note.content[:4000]}")
    if not note_tokens:
        return

    candidates = Note.objects.filter(user=note.user, is_deleted=False).exclude(id=note.id)
    for other in candidates:
        other_tokens = _tokenize(f"{other.title}\n{other.content[:4000]}")
        score = _cosine_overlap(note_tokens, other_tokens)
        if score < min_score:
            continue

        normalized = round(score, 3)
        NoteLink.objects.update_or_create(
            source_note=note,
            target_note=other,
            relationship_type=AUTO_LINK_RELATIONSHIP,
            defaults={"is_ai_generated": True, "similarity_score": normalized},
        )
        NoteLink.objects.update_or_create(
            source_note=other,
            target_note=note,
            relationship_type=AUTO_LINK_RELATIONSHIP,
            defaults={"is_ai_generated": True, "similarity_score": normalized},
        )