from django.db import DatabaseError, connection
from django.http import JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response

from config.exceptions import SERVER_ERROR_MESSAGE, error_body


@api_view(["GET"])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except DatabaseError:
        return Response({"status": "unavailable", "database": "unreachable"}, status=503)
    return Response({"status": "ok", "database": "ok"})


def not_found(request, exception=None):
    return JsonResponse(error_body("not_found", "The requested URL was not found."), status=404)


def server_error(request):
    return JsonResponse(error_body("server_error", SERVER_ERROR_MESSAGE), status=500)