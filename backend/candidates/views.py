from rest_framework.response import Response
from rest_framework.views import APIView

from candidates.serializers import (
    CandidateCreateSerializer,
    CandidateListQuerySerializer,
    CandidateSerializer,
)
from candidates.services import create_candidate, filter_candidates, get_candidate


class CandidateListCreateView(APIView):
    def get(self, request):
        query = CandidateListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        params = query.validated_data

        queryset = filter_candidates(search=params["search"], status=params.get("status"))
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