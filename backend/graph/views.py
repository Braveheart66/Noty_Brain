from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from notes.models import Note, NoteLink


class GraphView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def get(self, request):
		notes = Note.objects.filter(user=request.user, is_deleted=False).prefetch_related("tags")
		node_payload = [
			{
				"id": str(note.id),
				"title": note.title,
				"source_type": note.source_type,
				"updated_at": note.updated_at,
				"tags": [tag.name for tag in note.tags.all()],
			}
			for note in notes
		]

		links = NoteLink.objects.filter(
			source_note__user=request.user,
			source_note__is_deleted=False,
			target_note__is_deleted=False,
		).values(
			"id",
			"source_note_id",
			"target_note_id",
			"relationship_type",
			"is_ai_generated",
			"similarity_score",
		)
		# Collapse mirrored links (A->B and B->A) into a single graph edge.
		deduped_edges = {}
		for link in links:
			source_id = str(link["source_note_id"])
			target_id = str(link["target_note_id"])
			if source_id == target_id:
				continue

			left_id, right_id = sorted((source_id, target_id))
			relationship_type = link["relationship_type"]
			is_ai_generated = bool(link["is_ai_generated"])
			key = (left_id, right_id, relationship_type, is_ai_generated)

			score = link["similarity_score"]
			existing = deduped_edges.get(key)
			if existing is None:
				deduped_edges[key] = {
					"id": str(link["id"]),
					"source_note_id": left_id,
					"target_note_id": right_id,
					"relationship_type": relationship_type,
					"is_ai_generated": is_ai_generated,
					"similarity_score": score,
				}
				continue

			existing_score = existing["similarity_score"]
			if score is not None and (existing_score is None or score > existing_score):
				existing["similarity_score"] = score

		edge_payload = list(deduped_edges.values())
		return Response({"nodes": node_payload, "edges": edge_payload}, status=status.HTTP_200_OK)
