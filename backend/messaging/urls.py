from django.urls import path

from messaging.views import BulkMessageView, CandidateMessagesView, MessageCreateView, ProviderWebhookView

urlpatterns = [
    path("candidates/<str:public_id>/messages/", CandidateMessagesView.as_view(), name="candidate-messages"),
    path("messages/", MessageCreateView.as_view(), name="message-create"),
    path("messages/bulk/", BulkMessageView.as_view(), name="message-bulk"),
    path("webhooks/provider/", ProviderWebhookView.as_view(), name="provider-webhook"),
]