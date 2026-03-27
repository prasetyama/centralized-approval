"""
Auth SSO Middleware
===================
JWT authentication middleware for route protection.
"""
from django.http import JsonResponse
from django.conf import settings
from auth_sso.services import auth_service


class JWTAuthMiddleware:
    """
    Middleware that protects API routes requiring authentication.
    Skips authentication for public routes (login, admin, etc.).
    """

    # Routes that don't require authentication
    PUBLIC_PATHS = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/admin/',
        '/static/',
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        """
        Process request through JWT authentication middleware.
        Adds user info to request if token is valid.
        """
        # Skip auth for public paths
        if self._is_public_path(request.path):
            return self.get_response(request)

        # Skip if not an API route
        if not request.path.startswith('/api/'):
            return self.get_response(request)

        # Extract and validate token
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            payload = auth_service.validate_token(token)
            if payload:
                request.jwt_payload = payload

        return self.get_response(request)

    def _is_public_path(self, path):
        """Check if the request path is public (no auth required)."""
        return any(path.startswith(pp) for pp in self.PUBLIC_PATHS)
