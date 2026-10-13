from django.contrib import admin

from candidates.models import Candidate


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ("public_id", "full_name", "phone", "email", "created_at")
    search_fields = ("public_id", "full_name", "phone", "email")
    readonly_fields = ("public_id", "created_at", "updated_at")