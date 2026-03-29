from django.contrib.auth import get_user_model
import json
from unittest.mock import Mock, patch

from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from notes.models import Note


@override_settings(LLM_PROVIDER="none")
class SearchApiTests(APITestCase):
	def setUp(self):
		user_model = get_user_model()
		self.user = user_model.objects.create_user(
			email="search@example.com",
			username="searcher",
			password="strong-password",
		)
		self.client.force_authenticate(user=self.user)
		Note.objects.create(
			user=self.user,
			title="Microservices tradeoffs",
			content="Microservices improve team autonomy but increase distributed complexity and latency.",
		)
		Note.objects.create(
			user=self.user,
			title="Gardening checklist",
			content="Water the basil and prune dead leaves every Sunday.",
		)
		Note.objects.create(
			user=self.user,
			title="AI and Django",
			content="AI in Django apps with DRF endpoints and model inference.",
		)
		self.title_match_note = Note.objects.create(
			user=self.user,
			title="Neural Compression Primer",
			content="This note tracks conference logistics and travel checklist.",
		)

	def test_semantic_search_returns_relevant_note(self):
		response = self.client.post(
			"/api/search/",
			{"query": "microservices complexity"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(len(response.data["results"]), 1)
		self.assertEqual(response.data["results"][0]["title"], "Microservices tradeoffs")

	def test_semantic_search_accepts_text_plain_json_payload(self):
		response = self.client.post(
			"/api/search/",
			json.dumps({"query": "microservices complexity"}),
			content_type="text/plain",
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(len(response.data["results"]), 1)

	def test_semantic_search_supports_short_ai_query(self):
		response = self.client.post(
			"/api/search/",
			{"query": "ai"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(len(response.data["results"]), 1)
		titles = [result["title"] for result in response.data["results"]]
		self.assertIn("AI and Django", titles)

	def test_semantic_search_returns_exact_title_match(self):
		response = self.client.post(
			"/api/search/",
			{"query": "Neural Compression Primer"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		titles = [result["title"] for result in response.data["results"]]
		self.assertIn(self.title_match_note.title, titles)

	def test_semantic_search_returns_grounded_answer_payload(self):
		response = self.client.post(
			"/api/search/",
			{"query": "microservices complexity", "include_answer": True},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("answer", response.data)
		self.assertIn("source_notes", response.data)
		self.assertGreaterEqual(len(response.data["source_notes"]), 1)

	@override_settings(
		LLM_PROVIDER="ollama",
		OLLAMA_BASE_URL="http://host.docker.internal:11434",
		OLLAMA_MODEL="qwen2.5:7b-instruct",
		OLLAMA_TIMEOUT_SECONDS=5,
	)
	@patch("search.views.requests.post")
	def test_semantic_search_uses_ollama_for_answer_when_enabled(self, mock_post):
		mock_response = Mock()
		mock_response.raise_for_status.return_value = None
		mock_response.json.return_value = {"response": "Semantic answer from Ollama."}
		mock_post.return_value = mock_response

		response = self.client.post(
			"/api/search/",
			{"query": "AI and Django", "include_answer": True},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["answer"], "Semantic answer from Ollama.")
		self.assertGreaterEqual(len(response.data["source_notes"]), 1)
		self.assertEqual(mock_post.call_count, 1)

		_, kwargs = mock_post.call_args
		self.assertIn("one concise paragraph", kwargs["json"]["system"])

	@override_settings(
		LLM_PROVIDER="ollama",
		OLLAMA_BASE_URL="http://host.docker.internal:11434",
		OLLAMA_MODEL="qwen2.5:7b-instruct",
		OLLAMA_TIMEOUT_SECONDS=5,
	)
	@patch("search.views.requests.post")
	def test_semantic_search_passes_length_to_ollama(self, mock_post):
		mock_response = Mock()
		mock_response.raise_for_status.return_value = None
		mock_response.json.return_value = {"response": "Short semantic answer."}
		mock_post.return_value = mock_response

		response = self.client.post(
			"/api/search/",
			{
				"query": "AI and Django",
				"include_answer": True,
				"response_length": "short",
			},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["answer"], "Short semantic answer.")
		self.assertEqual(mock_post.call_count, 1)

		_, kwargs = mock_post.call_args
		system_prompt = kwargs["json"]["system"]
		self.assertIn("2-3 sentences", system_prompt)

	def test_ask_stores_history_and_sources(self):
		response = self.client.post(
			"/api/ask/",
			{"question": "What are microservices tradeoffs?"},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("answer", response.data)
		self.assertGreaterEqual(len(response.data["source_notes"]), 1)

		history_response = self.client.get("/api/ask/history/")
		self.assertEqual(history_response.status_code, status.HTTP_200_OK)
		self.assertGreaterEqual(len(history_response.data), 1)

	def test_ask_finds_note_when_question_matches_title(self):
		response = self.client.post(
			"/api/ask/",
			{"question": "Neural Compression Primer"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		source_titles = [note["title"] for note in response.data["source_notes"]]
		self.assertIn(self.title_match_note.title, source_titles)

	def test_ask_accepts_text_plain_json_payload(self):
		response = self.client.post(
			"/api/ask/",
			json.dumps({"question": "What are microservices tradeoffs?"}),
			content_type="text/plain",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("answer", response.data)

	@override_settings(
		LLM_PROVIDER="ollama",
		OLLAMA_BASE_URL="http://host.docker.internal:11434",
		OLLAMA_MODEL="qwen2.5:7b-instruct",
		OLLAMA_TIMEOUT_SECONDS=5,
	)
	@patch("search.views.requests.post")
	def test_ask_uses_ollama_when_enabled(self, mock_post):
		mock_response = Mock()
		mock_response.raise_for_status.return_value = None
		mock_response.json.return_value = {"response": "Ollama grounded answer."}
		mock_post.return_value = mock_response

		response = self.client.post(
			"/api/ask/",
			{"question": "What do I know about AI and Django?"},
			format="json",
		)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["answer"], "Ollama grounded answer.")
		self.assertGreaterEqual(len(response.data["source_notes"]), 1)
		self.assertEqual(mock_post.call_count, 1)

		_, kwargs = mock_post.call_args
		self.assertEqual(kwargs["json"]["model"], "qwen2.5:7b-instruct")
		self.assertFalse(kwargs["json"]["stream"])
