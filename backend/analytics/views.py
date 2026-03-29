import math
import re
from collections import Counter, defaultdict
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from notes.models import Note, NoteLink, QueryHistory

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

CLUSTER_SIMILARITY_THRESHOLD = 0.24


def _tokenize(text: str) -> list[str]:
	tokens = re.findall(r"[a-zA-Z0-9']+", text.lower())
	return [token for token in tokens if len(token) >= 2 and token not in STOP_WORDS]


def _token_similarity(tokens_a: set[str], tokens_b: set[str]) -> float:
	if not tokens_a or not tokens_b:
		return 0.0
	overlap = len(tokens_a.intersection(tokens_b))
	if overlap == 0:
		return 0.0
	return overlap / math.sqrt(len(tokens_a) * len(tokens_b))


class DashboardStatsView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		notes = Note.objects.filter(user=request.user, is_deleted=False)
		query_history = QueryHistory.objects.filter(user=request.user)
		now = timezone.now()
		week_ago = now - timedelta(days=7)

		total_notes = notes.count()
		notes_added_this_week = notes.filter(created_at__gte=week_ago).count()
		questions_count = query_history.count()
		most_connected = (
			notes.annotate(
				outgoing_count=Count("outgoing_links", filter=Q(outgoing_links__target_note__is_deleted=False), distinct=True),
				incoming_count=Count("incoming_links", filter=Q(incoming_links__source_note__is_deleted=False), distinct=True),
			)
			.order_by("-outgoing_count", "-incoming_count")
			.values("id", "title", "outgoing_count", "incoming_count")[:5]
		)

		most_connected_payload = []
		for item in most_connected:
			link_count = item["outgoing_count"] + item["incoming_count"]
			most_connected_payload.append(
				{
					"id": item["id"],
					"title": item["title"],
					"link_count": link_count,
				}
			)

		orphan_notes = (
			notes.annotate(
				outgoing_count=Count("outgoing_links", filter=Q(outgoing_links__target_note__is_deleted=False), distinct=True),
				incoming_count=Count("incoming_links", filter=Q(incoming_links__source_note__is_deleted=False), distinct=True),
			)
			.filter(outgoing_count=0, incoming_count=0)
			.values("id", "title")[:10]
		)

		growth = (
			notes.annotate(day=TruncDate("created_at"))
			.values("day")
			.annotate(count=Count("id"))
			.order_by("day")
		)

		recent_queries = query_history.values("question", "answer", "created_at")[:5]

		return Response(
			{
				"total_notes": total_notes,
				"notes_added_this_week": notes_added_this_week,
				"questions_count": questions_count,
				"most_connected_notes": most_connected_payload,
				"orphan_notes": list(orphan_notes),
				"knowledge_growth": [
					{
						"day": row["day"],
						"count": row["count"],
					}
					for row in growth
				],
				"recent_queries": list(recent_queries),
			},
			status=status.HTTP_200_OK,
		)


class ClusterAnalysisView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		notes = list(
			Note.objects.filter(user=request.user, is_deleted=False).values("id", "title", "content")
		)
		note_by_id = {str(note["id"]): note for note in notes}
		adjacency = defaultdict(set)
		tokens_by_note = {}

		for note_id in note_by_id:
			adjacency[note_id]

		for note_id, note in note_by_id.items():
			text_sample = f"{note['title']} {note['content'][:1000]}"
			tokens_by_note[note_id] = set(_tokenize(text_sample))

		if len(tokens_by_note) >= 4:
			token_note_frequency = Counter(
				token
				for token_set in tokens_by_note.values()
				for token in token_set
			)
			common_cutoff = max(2, math.ceil(len(tokens_by_note) * 0.6))
			for note_id, token_set in list(tokens_by_note.items()):
				filtered = {
					token
					for token in token_set
					if token_note_frequency[token] < common_cutoff
				}
				if filtered:
					tokens_by_note[note_id] = filtered

		note_ids = list(note_by_id.keys())
		for idx, source_id in enumerate(note_ids):
			for target_id in note_ids[idx + 1 :]:
				score = _token_similarity(tokens_by_note[source_id], tokens_by_note[target_id])
				if score >= CLUSTER_SIMILARITY_THRESHOLD:
					adjacency[source_id].add(target_id)
					adjacency[target_id].add(source_id)

		links = NoteLink.objects.filter(
			source_note__user=request.user,
			source_note__is_deleted=False,
			target_note__is_deleted=False,
			is_ai_generated=False,
		).values("source_note_id", "target_note_id")

		for link in links:
			source_id = str(link["source_note_id"])
			target_id = str(link["target_note_id"])
			adjacency[source_id].add(target_id)
			adjacency[target_id].add(source_id)

		visited = set()
		clusters = []
		for node in adjacency:
			if node in visited:
				continue
			stack = [node]
			component = []
			while stack:
				current = stack.pop()
				if current in visited:
					continue
				visited.add(current)
				component.append(current)
				stack.extend(list(adjacency[current] - visited))

			tokens = []
			for note_id in component:
				tokens.extend(tokens_by_note.get(note_id, set()))

			common = Counter(tokens).most_common(2)
			if common:
				label = " / ".join(word for word, _ in common)
			else:
				label = f"Cluster {len(clusters) + 1}"

			clusters.append(
				{
					"label": label,
					"size": len(component),
					"notes": [
						{
							"id": note_id,
							"title": note_by_id[note_id]["title"],
						}
						for note_id in component
						if note_id in note_by_id
					],
				}
			)

		clusters.sort(key=lambda item: item["size"], reverse=True)
		suggested_k = int(math.sqrt(max(1, len(notes)) / 2))

		return Response(
			{
				"note_count": len(notes),
				"suggested_k": max(1, suggested_k),
				"clusters": clusters,
			},
			status=status.HTTP_200_OK,
		)
