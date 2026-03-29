from django.urls import path

from .views import ClusterAnalysisView, DashboardStatsView

urlpatterns = [
    path("dashboard/", DashboardStatsView.as_view(), name="analytics-dashboard"),
    path("clusters/", ClusterAnalysisView.as_view(), name="analytics-clusters"),
]
