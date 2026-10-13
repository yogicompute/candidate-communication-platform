from django.core.management.base import BaseCommand
from django.db.models import Q

from candidates.models import Candidate

SEED_CANDIDATES = [
    ("A1B2C3", "Krishna Khandelwal", "+919876543210", "krishna.khandelwal@example.com"),
    ("D4E5F6", "Urvashi Soni", "+919123456789", "urvashi.soni@example.com"),
    ("G7H8I9", "Aditya Kumar", "+919988766554", "aditya.kumar@example.com"),
    ("J1K2L3", "Ajit Srivastava", "+919234567890", "ajit.srivastava@example.com"),
    ("M4N5O6", "Aniket Sawant", "+919876512345", "aniket.sawant@example.com"),
    ("P7Q8R9", "Ira Akbar", "+919456789012", "ira.akbar@example.com"),
    ("S1T2U3", "Amarjeet Kumar", "+919012345678", "amarjeet.kumar@example.com"),
    ("V4W5X6", "Neha Sharma", "+919811122233", "neha.sharma@example.com"),
    ("Y7Z8A9", "Rohan Mehta", "+919822233344", "rohan.mehta@example.com"),
    ("B1C2D3", "Priya Nair", "+919833344455", "priya.nair@example.com"),
    ("E4F5G6", "Sameer Khan", "+919844455566", "sameer.khan@example.com"),
    ("H7J8K9", "Kavya Iyer", "+919855566677", "kavya.iyer@example.com"),
]


class Command(BaseCommand):
    help = "Create the demo candidates from the Figma design. Safe to run repeatedly."

    def handle(self, *args, **options):
        created = 0
        for public_id, full_name, phone, email in reversed(SEED_CANDIDATES):
            if Candidate.objects.filter(Q(public_id=public_id) | Q(phone=phone)).exists():
                continue
            Candidate.objects.create(public_id=public_id, full_name=full_name, phone=phone, email=email)
            created += 1
        skipped = len(SEED_CANDIDATES) - created
        self.stdout.write(self.style.SUCCESS(f"Created {created} candidates ({skipped} already existed)."))