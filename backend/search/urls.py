from django.urls import path

from .views import AskView, QueryHistoryView, SemanticSearchView

urlpatterns = [
    path("search/", SemanticSearchView.as_view(), name="semantic-search"),
    path("ask/", AskView.as_view(), name="ask"),
    path("ask/history/", QueryHistoryView.as_view(), name="ask-history"),
]
