from django.core.management.base import BaseCommand

from messaging.idempotency import purge_idempotency_records


class Command(BaseCommand):
    help = (
        "Delete idempotency records older than 24 hours and requests left 'in progress' for over "
        "15 minutes. Safe to run at any time; the scheduler also runs it."
    )

    def handle(self, *args, **options):
        result = purge_idempotency_records()
        self.stdout.write(
            self.style.SUCCESS(
                f"Purged {result['expired']} expired and {result['abandoned']} abandoned idempotency records."
            )
        )
