import math
import re

import requests
from django.conf import settings
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from notes.models import Note, QueryHistory

SEARCH_THRESHOLD = 0.18
RESPONSE_LENGTH_HINTS = {
	"short": "Keep the answer very short (2-3 sentences).",
	"medium": "Keep the answer medium length (one concise paragraph).",
	"long": "Provide a detailed answer (2-3 short paragraphs).",
}

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
	"how",
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
	"was",
	"what",
	"when",
	"where",
	"who",
	"why",
	"with",
}


def _tokenize(text: str) -> set[str]:
	tokens = re.findall(r"[a-zA-Z0-9']+", text.lower())
	# Keep short acronyms (e.g., ai/ml/dl) so short semantic queries still work.
	return {token for token in tokens if len(token) >= 2 and token not in STOP_WORDS}


def _split_chunks(content: str) -> list[str]:
	chunks = [chunk.strip() for chunk in re.split(r"\n\s*\n", content) if chunk.strip()]
	if chunks:
		return chunks
	return [content.strip()] if content.strip() else []


def _cosine_like_similarity(query_tokens: set[str], text_tokens: set[str]) -> float:
	if not query_tokens or not text_tokens:
		return 0.0
	intersection = len(query_tokens.intersection(text_tokens))
	return intersection / math.sqrt(len(query_tokens) * len(text_tokens))


def _build_excerpt(chunk: str, max_len: int = 240) -> str:
	clean = re.sub(r"\s+", " ", chunk).strip()
	if len(clean) <= max_len:
		return clean
	return f"{clean[: max_len - 3]}..."


def _build_context(chunk: str, max_len: int = 1200) -> str:
	clean = re.sub(r"\s+", " ", chunk).strip()
	if len(clean) <= max_len:
		return clean
	return f"{clean[: max_len - 3]}..."


def _normalize_text(value: str) -> str:
	return re.sub(r"\s+", " ", value).strip().lower()


def _build_fallback_answer(matches: list[dict], response_length: str = "medium") -> str:
	max_points = {"short": 2, "medium": 4, "long": 6}.get(response_length, 4)
	bullets = []
	for match in matches[:max_points]:
		note_title = match["note"].title
		excerpt = match["excerpt"]
		bullets.append(f"- {excerpt} [Note: {note_title}]")
	return "Based on your notes:\n" + "\n".join(bullets)


def _generate_answer_with_ollama(
	question: str,
	matches: list[dict],
	response_length: str = "medium",
) -> str:
	context_sections = []
	for idx, match in enumerate(matches, start=1):
		note = match["note"]
		context_sections.append(
			f"Source {idx}:\n"
			f"Title: {note.title}\n"
			f"Similarity: {match['score']}\n"
			f"Context: {match['context']}"
		)

	context = "\n\n".join(context_sections)
	length_hint = RESPONSE_LENGTH_HINTS.get(response_length, RESPONSE_LENGTH_HINTS["medium"])
	provider_prompt = (
		"You are a grounded assistant. Answer only using the provided sources. "
		"If information is missing, say so clearly. End each key point with citation tags "
		"like [Source 1], [Source 2]. "
		f"{length_hint}"
	)
	user_prompt = (
		f"Question: {question}\n\n"
		f"Sources:\n{context}\n\n"
		"Provide a concise, accurate answer with citations."
	)

	url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
	payload = {
		"model": settings.OLLAMA_MODEL,
		"system": provider_prompt,
		"prompt": user_prompt,
		"stream": False,
		"keep_alive": "10m",
		"options": {"temperature": 0.2},
	}
	response = requests.post(url, json=payload, timeout=settings.OLLAMA_TIMEOUT_SECONDS)
	response.raise_for_status()
	answer = (response.json().get("response") or "").strip()
	if not answer:
		raise ValueError("Ollama response was empty")
	return answer


def _build_grounded_answer(
	question: str,
	matches: list[dict],
	response_length: str = "medium",
) -> str:
	provider = (getattr(settings, "LLM_PROVIDER", "none") or "none").lower()
	if provider == "ollama":
		try:
			return _generate_answer_with_ollama(
				question,
				matches,
				response_length=response_length,
			)
		except Exception:
			pass
	return _build_fallback_answer(matches, response_length=response_length)


def _semantic_note_matches(
	user,
	query: str,
	limit: int = 10,
	min_score: float = SEARCH_THRESHOLD,
	tag_id: str | None = None,
	start_date: str | None = None,
	end_date: str | None = None,
):
	query_tokens = _tokenize(query)
	query_text = _normalize_text(query)
	if not query_tokens and not query_text:
		return []

	notes = Note.objects.filter(user=user, is_deleted=False).prefetch_related("tags")
	if tag_id:
		notes = notes.filter(tags__id=tag_id)
	if start_date:
		notes = notes.filter(created_at__date__gte=start_date)
	if end_date:
		notes = notes.filter(created_at__date__lte=end_date)
	notes = notes.distinct()
	results = []
	for note in notes:
		title_text = _normalize_text(note.title)
		title_tokens = _tokenize(note.title)
		title_score = _cosine_like_similarity(query_tokens, title_tokens) if query_tokens else 0.0
		exact_title_match = bool(query_text and title_text == query_text)
		partial_title_match = bool(query_text and query_text in title_text)

		best_score = 0.0
		best_chunk = ""
		for chunk in _split_chunks(note.content):
			score = _cosine_like_similarity(query_tokens, _tokenize(chunk))
			if score > best_score:
				best_score = score
				best_chunk = chunk

		title_score = min(
			1.0,
			title_score
			+ (0.42 if exact_title_match else 0.16 if partial_title_match else 0.0),
		)
		final_score = max(best_score, title_score)

		if not best_chunk:
			best_chunk = note.content[:500] or note.title
		context = _build_context(best_chunk or note.content or note.title)

		if final_score >= min_score:
			results.append(
				{
					"note": note,
					"score": round(final_score, 3),
					"excerpt": _build_excerpt(best_chunk),
					"context": context,
				}
			)

	if not results and query_text:
		for note in notes:
			title_text = _normalize_text(note.title)
			content_text = _normalize_text(note.content)
			if query_text in title_text or query_text in content_text:
				results.append(
					{
						"note": note,
						"score": 0.2,
						"excerpt": _build_excerpt(note.content[:500] or note.title),
						"context": _build_context(note.content or note.title),
					}
				)

	results.sort(key=lambda item: item["score"], reverse=True)
	return results[:limit]


class SearchRequestSerializer(serializers.Serializer):
	query = serializers.CharField()
	tag_id = serializers.UUIDField(required=False)
	start_date = serializers.DateField(required=False)
	end_date = serializers.DateField(required=False)
	include_answer = serializers.BooleanField(required=False, default=True)
	response_length = serializers.ChoiceField(
		choices=["short", "medium", "long"],
		required=False,
		default="medium",
	)


class AskRequestSerializer(serializers.Serializer):
	question = serializers.CharField()


class SemanticSearchView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = SearchRequestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		query = serializer.validated_data["query"]
		include_answer = serializer.validated_data.get("include_answer", True)
		response_length = serializer.validated_data.get("response_length", "medium")
		matches = _semantic_note_matches(
			request.user,
			query=query,
			limit=10,
			tag_id=str(serializer.validated_data.get("tag_id")) if serializer.validated_data.get("tag_id") else None,
			start_date=str(serializer.validated_data.get("start_date")) if serializer.validated_data.get("start_date") else None,
			end_date=str(serializer.validated_data.get("end_date")) if serializer.validated_data.get("end_date") else None,
		)

		response_payload = {
			"query": query,
			"results": [
				{
					"note_id": str(match["note"].id),
					"title": match["note"].title,
					"excerpt": match["excerpt"],
					"similarity_score": match["score"],
					"source_type": match["note"].source_type,
				}
				for match in matches
			],
		}

		if include_answer:
			if not matches:
				response_payload["answer"] = "No relevant notes found for this search"
				response_payload["source_notes"] = []
				response_payload["confidence"] = 0.0
			else:
				shortlisted = matches[:5]
				response_payload["answer"] = _build_grounded_answer(
					query,
					shortlisted,
					response_length=response_length,
				)
				response_payload["source_notes"] = [
					{
						"id": str(match["note"].id),
						"title": match["note"].title,
						"similarity_score": match["score"],
					}
					for match in shortlisted
				]
				response_payload["confidence"] = round(
					sum(match["score"] for match in shortlisted) / len(shortlisted),
					3,
				)

		return Response(response_payload, status=status.HTTP_200_OK)


class AskView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = AskRequestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		question = serializer.validated_data["question"]
		matches = _semantic_note_matches(request.user, query=question, limit=5)

		if not matches:
			answer = "No relevant notes found for this question"
			avg_similarity = 0.0
			source_note_ids = []
			source_notes = []
		else:
			answer = _build_grounded_answer(question, matches)
			avg_similarity = round(sum(match["score"] for match in matches) / len(matches), 3)
			source_note_ids = [str(match["note"].id) for match in matches]
			source_notes = [
				{
					"id": str(match["note"].id),
					"title": match["note"].title,
					"similarity_score": match["score"],
				}
				for match in matches
			]

		QueryHistory.objects.create(
			user=request.user,
			question=question,
			answer=answer,
			source_note_ids=source_note_ids,
			avg_similarity=avg_similarity,
		)

		return Response(
			{
				"answer": answer,
				"source_notes": source_notes,
				"confidence": avg_similarity,
			},
			status=status.HTTP_200_OK,
		)


class QueryHistoryView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		limit = request.query_params.get("limit", "20")
		try:
			limit_value = max(1, min(100, int(limit)))
		except ValueError:
			limit_value = 20

		history = QueryHistory.objects.filter(user=request.user).values(
			"id",
			"question",
			"answer",
			"source_note_ids",
			"avg_similarity",
			"created_at",
		)[:limit_value]
		return Response(list(history), status=status.HTTP_200_OK)
