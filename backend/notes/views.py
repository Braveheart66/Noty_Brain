from urllib.parse import urlparse

import fitz
import requests
from bs4 import BeautifulSoup
from django.utils import timezone
from rest_framework import parsers
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import serializers

try:
	from readability import Document as ReadabilityDocument
except Exception:  # pragma: no cover - fallback parser path below
	ReadabilityDocument = None

from .models import Note, NoteLink, Tag
from .linking import refresh_ai_links_for_note
from .serializers import NoteDetailSerializer, NoteLinkSerializer, NoteSerializer, TagSerializer

MAX_PDF_UPLOAD_BYTES = 20 * 1024 * 1024


def _clean_text(raw_text: str) -> str:
	lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
	return "\n".join(lines)


def _extract_content_from_html(html: str) -> tuple[str, str]:
	title = ""
	if ReadabilityDocument is not None:
		try:
			readable = ReadabilityDocument(html)
			title = readable.short_title() or ""
			readable_html = readable.summary(html_partial=True)
			soup = BeautifulSoup(readable_html, "html.parser")
			text = _clean_text(soup.get_text("\n"))
			if text:
				return title, text
		except Exception:
			pass

	soup = BeautifulSoup(html, "html.parser")
	if not title and soup.title and soup.title.string:
		title = soup.title.string.strip()

	for tag in soup(["script", "style", "noscript"]):
		tag.decompose()

	content_root = soup.find("main") or soup.find("article") or soup.body or soup
	return title, _clean_text(content_root.get_text("\n"))


class URLIngestSerializer(serializers.Serializer):
	url = serializers.URLField()
	title = serializers.CharField(required=False, allow_blank=True, max_length=255)


class TextIngestSerializer(serializers.Serializer):
	content = serializers.CharField()
	title = serializers.CharField(required=False, allow_blank=True, max_length=255)


class PDFIngestSerializer(serializers.Serializer):
	file = serializers.FileField()
	title = serializers.CharField(required=False, allow_blank=True, max_length=255)

	def validate_file(self, value):
		if value.size > MAX_PDF_UPLOAD_BYTES:
			raise serializers.ValidationError("PDF exceeds 20 MB size limit.")
		if not value.name.lower().endswith(".pdf"):
			raise serializers.ValidationError("Only PDF uploads are supported.")
		return value


class TagViewSet(viewsets.ModelViewSet):
	serializer_class = TagSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_queryset(self):
		return Tag.objects.filter(user=self.request.user)

	def perform_create(self, serializer):
		serializer.save(user=self.request.user)


class NoteViewSet(viewsets.ModelViewSet):
	serializer_class = NoteSerializer
	permission_classes = [permissions.IsAuthenticated]

	def get_serializer_class(self):
		if self.action == "retrieve":
			return NoteDetailSerializer
		return NoteSerializer

	def get_queryset(self):
		queryset = Note.objects.filter(user=self.request.user)
		include_deleted = self.request.query_params.get("include_deleted", "false").lower() == "true"
		if not include_deleted:
			queryset = queryset.filter(is_deleted=False)

		tag_id = self.request.query_params.get("tag")
		if tag_id:
			queryset = queryset.filter(tags__id=tag_id)

		start_date = self.request.query_params.get("start_date")
		end_date = self.request.query_params.get("end_date")
		if start_date:
			queryset = queryset.filter(created_at__date__gte=start_date)
		if end_date:
			queryset = queryset.filter(created_at__date__lte=end_date)

		return queryset.distinct()

	def perform_destroy(self, instance):
		instance.is_deleted = True
		instance.deleted_at = timezone.now()
		instance.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
		refresh_ai_links_for_note(instance)

	@action(detail=True, methods=["post"])
	def restore(self, request, pk=None):
		note = self.get_object()
		note.is_deleted = False
		note.deleted_at = None
		note.save(update_fields=["is_deleted", "deleted_at", "updated_at"])
		refresh_ai_links_for_note(note)
		return Response(self.get_serializer(note).data, status=status.HTTP_200_OK)

	@action(detail=True, methods=["post"], url_path="links")
	def add_link(self, request, pk=None):
		source_note = self.get_object()
		serializer = NoteLinkSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		target_note = serializer.validated_data["target_note"]
		relationship_type = serializer.validated_data["relationship_type"]

		if target_note.user_id != request.user.id:
			return Response({"detail": "Target note not found."}, status=status.HTTP_404_NOT_FOUND)

		link, _ = NoteLink.objects.get_or_create(
			source_note=source_note,
			target_note=target_note,
			relationship_type=relationship_type,
			defaults={"is_ai_generated": False},
		)
		NoteLink.objects.get_or_create(
			source_note=target_note,
			target_note=source_note,
			relationship_type=relationship_type,
			defaults={"is_ai_generated": False},
		)

		return Response(NoteLinkSerializer(link).data, status=status.HTTP_201_CREATED)

	@action(detail=True, methods=["delete"], url_path=r"links/(?P<link_id>[^/.]+)")
	def remove_link(self, request, pk=None, link_id=None):
		source_note = self.get_object()
		try:
			link = NoteLink.objects.get(id=link_id, source_note=source_note)
		except NoteLink.DoesNotExist:
			return Response({"detail": "Link not found."}, status=status.HTTP_404_NOT_FOUND)

		NoteLink.objects.filter(
			source_note=link.target_note,
			target_note=link.source_note,
			relationship_type=link.relationship_type,
		).delete()
		link.delete()

		return Response(status=status.HTTP_204_NO_CONTENT)


class URLIngestView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = URLIngestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		url = serializer.validated_data["url"]
		provided_title = serializer.validated_data.get("title", "").strip()

		try:
			response = requests.get(
				url,
				timeout=15,
				headers={"User-Agent": "NotyBrainIngest/1.0"},
			)
		except requests.RequestException as exc:
			return Response(
				{"detail": f"Could not fetch URL: {exc}"},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if response.status_code >= 400:
			return Response(
				{"detail": f"Could not fetch URL (HTTP {response.status_code})."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		extracted_title, extracted_content = _extract_content_from_html(response.text)
		if not extracted_content:
			return Response(
				{
					"detail": "Page requires JavaScript or has no readable text content.",
				},
				status=status.HTTP_400_BAD_REQUEST,
			)

		title = provided_title or extracted_title or f"Imported from {urlparse(url).netloc}"
		note = Note.objects.create(
			user=request.user,
			title=title,
			content=extracted_content,
			source_type=Note.SOURCE_URL,
			source_ref=url,
		)
		refresh_ai_links_for_note(note)
		return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class TextIngestView(APIView):
	permission_classes = [permissions.IsAuthenticated]

	def post(self, request):
		serializer = TextIngestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		content = serializer.validated_data["content"].strip()
		if not content:
			return Response({"detail": "Content cannot be empty."}, status=status.HTTP_400_BAD_REQUEST)

		title = serializer.validated_data.get("title", "").strip() or "Imported Text"
		note = Note.objects.create(
			user=request.user,
			title=title,
			content=content,
			source_type=Note.SOURCE_MANUAL,
			source_ref="pasted_text",
		)
		refresh_ai_links_for_note(note)
		return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)


class PDFIngestView(APIView):
	permission_classes = [permissions.IsAuthenticated]
	parser_classes = [parsers.MultiPartParser, parsers.FormParser]

	def post(self, request):
		serializer = PDFIngestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		pdf_file = serializer.validated_data["file"]
		provided_title = serializer.validated_data.get("title", "").strip()

		try:
			document = fitz.open(stream=pdf_file.read(), filetype="pdf")
		except Exception:
			return Response({"detail": "Failed to parse PDF file."}, status=status.HTTP_400_BAD_REQUEST)

		pages = []
		for page_number, page in enumerate(document, start=1):
			page_text = page.get_text("text").strip()
			if page_text:
				pages.append(f"[Page {page_number}]\n{page_text}")

		document.close()

		if not pages:
			return Response(
				{"detail": "PDF contains no extractable text."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		title = provided_title or pdf_file.name.rsplit(".", 1)[0]
		note = Note.objects.create(
			user=request.user,
			title=title,
			content="\n\n".join(pages),
			source_type=Note.SOURCE_PDF,
			source_ref=pdf_file.name,
		)
		refresh_ai_links_for_note(note)
		return Response(NoteSerializer(note).data, status=status.HTTP_201_CREATED)
