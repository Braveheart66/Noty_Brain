from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/notes/", include("notes.urls")),
    path("api/", include("search.urls")),
    path("api/graph/", include("graph.urls")),
    path("api/analytics/", include("analytics.urls")),
]
