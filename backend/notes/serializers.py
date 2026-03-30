from django.db import transaction
from rest_framework import serializers

from .linking import refresh_ai_links_for_note
from .models import Note, NoteLink, NoteTag, NoteVersion, Tag, Template


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("id", "name", "color", "created_at")
        read_only_fields = ("id", "created_at")


class NoteVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteVersion
        fields = ("id", "content", "created_at")


class NoteSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.UUIDField(),
        write_only=True,
        required=False,
    )

    class Meta:
        model = Note
        fields = (
            "id",
            "icon_emoji",
            "title",
            "content_json",
            "content",
            "source_type",
            "source_ref",
            "embedding_status",
            "failed_embedding",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
            "tags",
            "tag_ids",
        )
        read_only_fields = (
            "id",
            "embedding_status",
            "failed_embedding",
            "is_deleted",
            "deleted_at",
            "created_at",
            "updated_at",
            "tags",
        )

    @transaction.atomic
    def create(self, validated_data):
        tag_ids = validated_data.pop("tag_ids", [])
        note = Note.objects.create(user=self.context["request"].user, **validated_data)
        if tag_ids:
            tags = Tag.objects.filter(user=note.user, id__in=tag_ids)
            NoteTag.objects.bulk_create([NoteTag(note=note, tag=tag) for tag in tags])
        refresh_ai_links_for_note(note)
        return note

    @transaction.atomic
    def update(self, instance, validated_data):
        tag_ids = validated_data.pop("tag_ids", None)
        should_refresh_links = any(field in validated_data for field in ("title", "content"))

        # Keep a rolling copy of the previous content before updating.
        if "content" in validated_data and validated_data["content"] != instance.content:
            NoteVersion.objects.create(note=instance, content=instance.content)
            old_versions = NoteVersion.objects.filter(note=instance).order_by("-created_at")[10:]
            if old_versions:
                NoteVersion.objects.filter(id__in=[v.id for v in old_versions]).delete()

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if tag_ids is not None:
            tags = Tag.objects.filter(user=instance.user, id__in=tag_ids)
            NoteTag.objects.filter(note=instance).delete()
            NoteTag.objects.bulk_create([NoteTag(note=instance, tag=tag) for tag in tags])

        if should_refresh_links:
            refresh_ai_links_for_note(instance)

        return instance


class NoteDetailSerializer(NoteSerializer):
    versions = NoteVersionSerializer(many=True, read_only=True)

    class Meta(NoteSerializer.Meta):
        fields = NoteSerializer.Meta.fields + ("versions",)


class NoteLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = NoteLink
        fields = (
            "id",
            "source_note",
            "target_note",
            "relationship_type",
            "is_ai_generated",
            "similarity_score",
            "created_at",
        )
        read_only_fields = ("id", "is_ai_generated", "similarity_score", "created_at")
        extra_kwargs = {
            "source_note": {"read_only": True},
            "relationship_type": {"required": False},
        }


class BacklinkSerializer(serializers.Serializer):
    link_id = serializers.UUIDField()
    relationship_type = serializers.CharField()
    is_ai_generated = serializers.BooleanField()
    note_id = serializers.UUIDField()
    icon_emoji = serializers.CharField()
    title = serializers.CharField()
    source_type = serializers.CharField()
    updated_at = serializers.DateTimeField()


class TemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Template
        fields = (
            "id",
            "name",
            "icon_emoji",
            "content_json",
            "content_text",
            "is_builtin",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "is_builtin",
            "created_at",
            "updated_at",
        )

    def create(self, validated_data):
        return Template.objects.create(user=self.context["request"].user, **validated_data)
