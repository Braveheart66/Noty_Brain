from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Note, NoteLink


class GraphApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			email="graph@example.com",
			username="grapher",
			password="strong-password",
		)
		self.client.force_authenticate(user=self.user)

		note_a = Note.objects.create(user=self.user, title="Node A", content="A")
		note_b = Note.objects.create(user=self.user, title="Node B", content="B")
		NoteLink.objects.create(source_note=note_a, target_note=note_b)

	def test_graph_endpoint_returns_nodes_and_edges(self):
		response = self.client.get("/api/graph/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("nodes", response.data)
		self.assertIn("edges", response.data)
		self.assertGreaterEqual(len(response.data["nodes"]), 2)
		self.assertGreaterEqual(len(response.data["edges"]), 1)
