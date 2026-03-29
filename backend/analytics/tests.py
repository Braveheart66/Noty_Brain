from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Note, NoteLink


class AnalyticsApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			email="analytics@example.com",
			username="analyst",
			password="strong-password",
		)
		self.client.force_authenticate(user=self.user)

		self.note_a = Note.objects.create(
			user=self.user,
			title="Distributed systems",
			content="Consensus and replication basics.",
		)
		self.note_b = Note.objects.create(
			user=self.user,
			title="CAP theorem",
			content="Consistency, availability, partition tolerance.",
		)
		NoteLink.objects.create(source_note=self.note_a, target_note=self.note_b)

	def test_dashboard_endpoint_returns_expected_keys(self):
		response = self.client.get("/api/analytics/dashboard/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("total_notes", response.data)
		self.assertIn("most_connected_notes", response.data)
		self.assertIn("orphan_notes", response.data)
		self.assertIn("knowledge_growth", response.data)

	def test_cluster_analysis_endpoint_returns_clusters(self):
		response = self.client.post("/api/analytics/clusters/", {}, format="json")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("clusters", response.data)
		self.assertGreaterEqual(len(response.data["clusters"]), 1)

	def test_cluster_analysis_separates_unrelated_topics(self):
		Note.objects.create(
			user=self.user,
			title="Sourdough fermentation",
			content="Hydration ratios, levain feeding schedule, and crumb structure.",
		)

		response = self.client.post("/api/analytics/clusters/", {}, format="json")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(len(response.data["clusters"]), 2)
