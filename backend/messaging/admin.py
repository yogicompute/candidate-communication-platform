from django.contrib import admin

from messaging.models import Message, MessageEvent


class MessageEventInline(admin.TabularInline):
    model = MessageEvent
    extra = 0
    can_delete = False
    fields = ("event_id", "status", "failure_code", "occurred_at", "received_at", "outcome")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


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
    inlines = [MessageEventInline]