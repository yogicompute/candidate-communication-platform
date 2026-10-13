from django.urls import path

from candidates.views import CandidateDetailView, CandidateListCreateView

urlpatterns = [
    path("candidates/", CandidateListCreateView.as_view(), name="candidate-list"),
    path("candidates/<str:public_id>/", CandidateDetailView.as_view(), name="candidate-detail"),
]