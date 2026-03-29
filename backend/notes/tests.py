from unittest.mock import Mock, patch
import json

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Note, NoteLink


class NotesApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			email="test@example.com",
			username="testuser",
			password="strong-password",
		)
		self.client.force_authenticate(user=self.user)

	def test_note_detail_includes_versions(self):
		note = Note.objects.create(user=self.user, title="Start", content="Old body")

		update_response = self.client.patch(
			f"/api/notes/{note.id}/",
			{"content": "New body"},
			format="json",
		)
		self.assertEqual(update_response.status_code, status.HTTP_200_OK)

		detail_response = self.client.get(f"/api/notes/{note.id}/")
		self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
		self.assertIn("versions", detail_response.data)
		self.assertEqual(len(detail_response.data["versions"]), 1)
		self.assertEqual(detail_response.data["versions"][0]["content"], "Old body")

	def test_ingest_text_creates_note(self):
		response = self.client.post(
			"/api/notes/ingest/text/",
			{"title": "Imported", "content": "Knowledge from clipboard"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["title"], "Imported")
		self.assertEqual(response.data["source_type"], Note.SOURCE_MANUAL)

	def test_create_note_accepts_text_plain_json_payload(self):
		response = self.client.post(
			"/api/notes/",
			json.dumps(
				{
					"title": "Text Plain Note",
					"content": "Created from a text/plain body",
					"source_type": "manual",
				}
			),
			content_type="text/plain",
		)

		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["title"], "Text Plain Note")

	def test_creating_related_notes_auto_generates_ai_links(self):
		first = self.client.post(
			"/api/notes/",
			{
				"title": "AI and Django Overview",
				"content": "AI models can be exposed through Django and DRF APIs.",
				"source_type": "manual",
			},
			format="json",
		)
		self.assertEqual(first.status_code, status.HTTP_201_CREATED)

		second = self.client.post(
			"/api/notes/",
			{
				"title": "Deploying AI with Django",
				"content": "Django serves AI inference endpoints and integrates model predictions.",
				"source_type": "manual",
			},
			format="json",
		)
		self.assertEqual(second.status_code, status.HTTP_201_CREATED)

		auto_links = NoteLink.objects.filter(is_ai_generated=True)
		self.assertGreaterEqual(auto_links.count(), 2)

	@patch("notes.views.requests.get")
	def test_ingest_url_creates_note(self, mock_get):
		mock_response = Mock()
		mock_response.status_code = 200
		mock_response.text = "<html><head><title>Source</title></head><body><main>Useful article text.</main></body></html>"
		mock_get.return_value = mock_response

		response = self.client.post(
			"/api/notes/ingest/url/",
			{"url": "https://example.com/article"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(response.data["source_type"], Note.SOURCE_URL)
