from django.urls import path

from messaging.views import (
    BulkMessageView,
    CancelScheduledView,
    CandidateMessagesView,
    CandidateScheduledView,
    MessageCreateView,
    ProviderWebhookView,
    RetryMessageView,
    ScheduleMessagesView,
    TemplateDetailView,
    TemplateListCreateView,
)

urlpatterns = [
    path("candidates/<str:public_id>/messages/", CandidateMessagesView.as_view(), name="candidate-messages"),
    path("messages/", MessageCreateView.as_view(), name="message-create"),
    path("messages/bulk/", BulkMessageView.as_view(), name="message-bulk"),
    path(
        "candidates/<str:public_id>/scheduled-messages/",
        CandidateScheduledView.as_view(),
        name="candidate-scheduled-messages",
    ),
    path("messages/schedule/", ScheduleMessagesView.as_view(), name="message-schedule"),
    path("scheduled-messages/<str:public_id>/cancel/", CancelScheduledView.as_view(), name="scheduled-cancel"),
    path("messages/<str:public_id>/retry/", RetryMessageView.as_view(), name="message-retry"),
    path("templates/", TemplateListCreateView.as_view(), name="template-list"),
    path("templates/<str:public_id>/", TemplateDetailView.as_view(), name="template-detail"),
    path("webhooks/provider/", ProviderWebhookView.as_view(), name="provider-webhook"),
]