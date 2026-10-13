from django.contrib import admin
from django.urls import include, path

from config.views import health

api_v1_patterns = [
    path("health/", health, name="health"),
    path("", include("candidates.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include(api_v1_patterns)),
]

handler404 = "config.views.not_found"
handler500 = "config.views.server_error"