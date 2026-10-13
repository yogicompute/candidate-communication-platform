from django.urls import path

from messaging.views import BulkMessageView, CandidateMessagesView, MessageCreateView

urlpatterns = [
    path("candidates/<str:public_id>/messages/", CandidateMessagesView.as_view(), name="candidate-messages"),
    path("messages/", MessageCreateView.as_view(), name="message-create"),
    path("messages/bulk/", BulkMessageView.as_view(), name="message-bulk"),
]