import logging
import time

from django.core.management.base import BaseCommand
from django.db import close_old_connections

from messaging.idempotency import purge_idempotency_records
from messaging.scheduler import dispatch_due

logger = logging.getLogger(__name__)

PURGE_EVERY_SECONDS = 10 * 60


class Command(BaseCommand):
    help = (
        "Send scheduled messages when they are due and purge old idempotency records. "
        "Runs until stopped; use --once for a single pass."
    )

    def add_arguments(self, parser):
        parser.add_argument("--interval", type=int, default=30, help="Seconds between passes (default 30).")
        parser.add_argument("--once", action="store_true", help="Run one pass and exit.")

    def handle(self, *args, **options):
        interval = max(1, options["interval"])
        last_purge = 0.0
        if not options["once"]:
            self.stdout.write(f"Scheduler started; checking every {interval}s.")
        while True:
            close_old_connections()
            try:
                counts = dispatch_due()
                if any(counts.values()):
                    logger.info("Scheduled messages: %s", counts)
                if time.monotonic() - last_purge >= PURGE_EVERY_SECONDS or options["once"]:
                    purged = purge_idempotency_records()
                    last_purge = time.monotonic()
                    if any(purged.values()):
                        logger.info("Idempotency records purged: %s", purged)
            except Exception:
                # Keep the loop alive (e.g. the database restarted); the next pass retries.
                logger.exception("Scheduler pass failed")
            if options["once"]:
                break
            time.sleep(interval)
