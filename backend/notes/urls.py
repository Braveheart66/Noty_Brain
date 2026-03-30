from django.urls import path

from .views import NoteViewSet, PDFIngestView, TagViewSet, TemplateListCreateView, TextIngestView, URLIngestView

note_list = NoteViewSet.as_view({"get": "list", "post": "create"})
note_detail = NoteViewSet.as_view({"get": "retrieve", "patch": "partial_update", "delete": "destroy"})
note_restore = NoteViewSet.as_view({"post": "restore"})
note_links_add = NoteViewSet.as_view({"post": "add_link"})
note_links_remove = NoteViewSet.as_view({"delete": "remove_link"})
note_backlinks = NoteViewSet.as_view({"get": "backlinks"})

tag_list = TagViewSet.as_view({"get": "list", "post": "create"})
tag_detail = TagViewSet.as_view({"patch": "partial_update", "delete": "destroy"})

urlpatterns = [
    path("", note_list, name="notes-list"),
    path("templates/", TemplateListCreateView.as_view(), name="templates-list-create"),
    path("ingest/url/", URLIngestView.as_view(), name="notes-ingest-url"),
    path("ingest/pdf/", PDFIngestView.as_view(), name="notes-ingest-pdf"),
    path("ingest/text/", TextIngestView.as_view(), name="notes-ingest-text"),
    path("tags/", tag_list, name="tags-list"),
    path("tags/<uuid:pk>/", tag_detail, name="tags-detail"),
    path("<uuid:pk>/", note_detail, name="notes-detail"),
    path("<uuid:pk>/restore/", note_restore, name="notes-restore"),
    path("<uuid:pk>/links/", note_links_add, name="notes-link-add"),
    path("<uuid:pk>/links/<uuid:link_id>/", note_links_remove, name="notes-link-remove"),
    path("<uuid:pk>/backlinks/", note_backlinks, name="notes-backlinks"),
]
