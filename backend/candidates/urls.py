from django.urls import path

from candidates.views import CandidateBulkDeleteView, CandidateDetailView, CandidateListCreateView

urlpatterns = [
    path("candidates/", CandidateListCreateView.as_view(), name="candidate-list"),
    path("candidates/bulk-delete/", CandidateBulkDeleteView.as_view(), name="candidate-bulk-delete"),
    path("candidates/<str:public_id>/", CandidateDetailView.as_view(), name="candidate-detail"),
]
