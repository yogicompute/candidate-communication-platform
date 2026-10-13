import secrets

from django.db import models
from django.db.models.functions import Lower

PUBLIC_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PUBLIC_ID_LENGTH = 6


def generate_public_id() -> str:
    return "".join(secrets.choice(PUBLIC_ID_ALPHABET) for _ in range(PUBLIC_ID_LENGTH))


class Candidate(models.Model):
    public_id = models.CharField(max_length=PUBLIC_ID_LENGTH, unique=True, editable=False)
    full_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=16, unique=True, help_text="E.164 format, e.g. +919876543210")
    email = models.EmailField(max_length=254)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(Lower("email"), name="candidate_email_ci_unique"),
        ]

    def __str__(self) -> str:
        return f"{self.full_name} ({self.public_id})"