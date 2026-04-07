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

	def test_backlinks_returns_source_notes(self):
		target = Note.objects.create(user=self.user, title="Target", content="Dest")
		source = Note.objects.create(user=self.user, title="Source", content="Src")
		NoteLink.objects.create(
			source_note=source,
			target_note=target,
			relationship_type="related to",
			is_ai_generated=False,
		)

		response = self.client.get(f"/api/notes/{target.id}/backlinks/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["title"], "Source")

	def test_backlinks_prefers_manual_over_ai_for_same_source(self):
		target = Note.objects.create(user=self.user, title="Target", content="Dest")
		source = Note.objects.create(user=self.user, title="Source", content="Src")
		NoteLink.objects.create(
			source_note=source,
			target_note=target,
			relationship_type="semantic related",
			is_ai_generated=True,
			similarity_score=0.82,
		)
		NoteLink.objects.create(
			source_note=source,
			target_note=target,
			relationship_type="references",
			is_ai_generated=False,
		)

		response = self.client.get(f"/api/notes/{target.id}/backlinks/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(len(response.data), 1)
		self.assertFalse(response.data[0]["is_ai_generated"])
		self.assertEqual(response.data[0]["relationship_type"], "references")

	def test_add_link_rejects_self_reference(self):
		note = Note.objects.create(user=self.user, title="Self", content="Self")
		response = self.client.post(
			f"/api/notes/{note.id}/links/",
			{"target_note": str(note.id), "relationship_type": "references"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn("detail", response.data)

	def test_templates_endpoint_returns_builtin_templates(self):
		response = self.client.get("/api/notes/templates/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		names = [item["name"] for item in response.data]
		self.assertIn("Meeting Notes", names)
		self.assertIn("Research", names)
		self.assertIn("Journal", names)

	def test_templates_endpoint_creates_user_template(self):
		payload = {
			"name": "My Custom",
			"icon_emoji": "✨",
			"content_text": "Heading\nBody",
			"content_json": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello"}]}]},
		}
		create_response = self.client.post("/api/notes/templates/", payload, format="json")
		self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
		self.assertEqual(create_response.data["name"], "My Custom")
		self.assertFalse(create_response.data["is_builtin"])
