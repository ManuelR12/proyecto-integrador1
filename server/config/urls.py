from django.contrib import admin
from django.urls import include, path
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView

from planner.views import EmailOrUsernameTokenObtainPairView

# add schema examples for token endpoints
EmailOrUsernameTokenObtainPairView = extend_schema_view(
	post=extend_schema(
		summary="Obtain token pair",
		description=(
			"Obtain access and refresh JWT tokens using username or email plus password. "
			"Supports `identifier` (preferred) and `username` (backward compatible)."
		),
		request={"type": "object"},
		responses={200: {"type": "object"}},
		examples=[
			OpenApiExample(
				"Token request (identifier)",
				value={"identifier": "juan@example.com", "password": "secret"},
				request_only=True,
			),
			OpenApiExample(
				"Token request (username)",
				value={"username": "juan", "password": "secret"},
				request_only=True,
			),
			OpenApiExample(
				"Token response",
				value={"access": "<jwt>", "refresh": "<jwt_refresh>"},
				response_only=True,
			),
		],
	)
)(EmailOrUsernameTokenObtainPairView)

TokenRefreshView = extend_schema_view(
	post=extend_schema(
		summary="Refresh access token",
		description="Refresh an access token using a refresh token.",
		request={"type": "object"},
		responses={200: {"type": "object"}},
		examples=[
			OpenApiExample(
				"Refresh request",
				value={"refresh": "<jwt_refresh>"},
				request_only=True,
			),
			OpenApiExample(
				"Refresh response",
				value={"access": "<jwt>"},
				response_only=True,
			),
		],
	)
)(TokenRefreshView)

urlpatterns = [
	path("admin/", admin.site.urls),
	path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
	path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
	path("api/token/", EmailOrUsernameTokenObtainPairView.as_view(), name="token_obtain_pair"),
	path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
	path("", include("planner.urls")),
]
