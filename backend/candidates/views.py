from rest_framework.response import Response
from rest_framework.views import APIView

from candidates.serializers import (
    CandidateBulkDeleteSerializer,
    CandidateCreateSerializer,
    CandidateListQuerySerializer,
    CandidateSerializer,
)
from candidates.services import create_candidate, delete_candidates, filter_candidates, get_candidate

PAGINATION_PARAMS = ("page", "page_size")


class CandidateListCreateView(APIView):
    def get(self, request):
        query = CandidateListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data

        filters = {key: value for key, value in params.items() if key not in PAGINATION_PARAMS}
        queryset = filter_candidates(**filters)
        page, page_size = params["page"], params["page_size"]
        start = (page - 1) * page_size

        return Response(
            {
                "count": queryset.count(),
                "page": page,
                "page_size": page_size,
                "results": CandidateSerializer(queryset[start : start + page_size], many=True).data,
            }
        )

    def post(self, request):
        serializer = CandidateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        candidate = create_candidate(**serializer.validated_data)
        return Response(CandidateSerializer(candidate).data, status=201)


class CandidateDetailView(APIView):
    def get(self, request, public_id: str):
        return Response(CandidateSerializer(get_candidate(public_id)).data)


class CandidateBulkDeleteView(APIView):
    def post(self, request):
        serializer = CandidateBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        requested = serializer.validated_data["candidate_ids"]

        deleted = delete_candidates(requested)
        deleted_set = set(deleted)
        return Response(
            {
                "deleted_ids": deleted,
                "not_found_ids": [public_id for public_id in requested if public_id not in deleted_set],
            }
        )
