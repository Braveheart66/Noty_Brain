import uuid

from django.conf import settings
from django.db import models


class Tag(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tags")
	name = models.CharField(max_length=64)
	color = models.CharField(max_length=7, default="#1f6feb")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("user", "name")
		ordering = ["name"]

	def __str__(self) -> str:
		return f"{self.user_id}:{self.name}"


class Note(models.Model):
	SOURCE_MANUAL = "manual"
	SOURCE_URL = "url"
	SOURCE_PDF = "pdf"
	SOURCE_CHOICES = (
		(SOURCE_MANUAL, "Manual"),
		(SOURCE_URL, "URL"),
		(SOURCE_PDF, "PDF"),
	)

	EMBEDDING_PENDING = "pending"
	EMBEDDING_DONE = "done"
	EMBEDDING_FAILED = "failed"
	EMBEDDING_STATUS_CHOICES = (
		(EMBEDDING_PENDING, "Pending"),
		(EMBEDDING_DONE, "Done"),
		(EMBEDDING_FAILED, "Failed"),
	)

	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notes")
	title = models.CharField(max_length=255)
	content = models.TextField(blank=True)
	source_type = models.CharField(max_length=16, choices=SOURCE_CHOICES, default=SOURCE_MANUAL)
	source_ref = models.TextField(blank=True)
	embedding_status = models.CharField(
		max_length=16,
		choices=EMBEDDING_STATUS_CHOICES,
		default=EMBEDDING_PENDING,
	)
	failed_embedding = models.BooleanField(default=False)
	is_deleted = models.BooleanField(default=False)
	deleted_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	tags = models.ManyToManyField(Tag, through="NoteTag", related_name="notes")

	class Meta:
		ordering = ["-updated_at"]

	def __str__(self) -> str:
		return self.title


class NoteVersion(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="versions")
	content = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]


class NoteTag(models.Model):
	note = models.ForeignKey(Note, on_delete=models.CASCADE)
	tag = models.ForeignKey(Tag, on_delete=models.CASCADE)

	class Meta:
		unique_together = ("note", "tag")


class NoteLink(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	source_note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="outgoing_links")
	target_note = models.ForeignKey(Note, on_delete=models.CASCADE, related_name="incoming_links")
	relationship_type = models.CharField(max_length=64, default="related to")
	is_ai_generated = models.BooleanField(default=False)
	similarity_score = models.FloatField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("source_note", "target_note", "relationship_type")


class QueryHistory(models.Model):
	id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
	user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="query_history")
	question = models.TextField()
	answer = models.TextField()
	source_note_ids = models.JSONField(default=list)
	avg_similarity = models.FloatField(default=0.0)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]
