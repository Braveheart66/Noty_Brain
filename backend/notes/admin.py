from django.contrib import admin

from .models import Note, NoteLink, NoteVersion, QueryHistory, Tag, Template

admin.site.register(Note)
admin.site.register(NoteVersion)
admin.site.register(Tag)
admin.site.register(NoteLink)
admin.site.register(QueryHistory)
admin.site.register(Template)
