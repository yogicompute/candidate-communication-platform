from django.contrib import admin

from messaging.models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "public_id",
        "candidate",
        "status",
        "attempt_number",
        "provider_reference",
        "failure_code",
        "created_at",
    )
    list_filter = ("status", "failure_code", "provider")
    search_fields = ("public_id", "provider_reference", "candidate__public_id", "candidate__full_name")
    raw_id_fields = ("candidate", "retry_of")
    readonly_fields = (
        "public_id",
        "provider_reference",
        "bulk_request_id",
        "attempt_number",
        "created_at",
        "updated_at",
        "sent_at",
        "delivered_at",
        "read_at",
        "failed_at",
    )