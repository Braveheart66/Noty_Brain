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
		edge_payload = [
			{
				"id": str(link["id"]),
				"source_note_id": str(link["source_note_id"]),
				"target_note_id": str(link["target_note_id"]),
				"relationship_type": link["relationship_type"],
				"is_ai_generated": link["is_ai_generated"],
				"similarity_score": link["similarity_score"],
			}
			for link in links
		]
		return Response({"nodes": node_payload, "edges": edge_payload}, status=status.HTTP_200_OK)
