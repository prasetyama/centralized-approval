"""
JWT Authentication Backend
===========================
DRF authentication class that integrates with MockAuthService.
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from core.models import User
from auth_sso.services import auth_service


class JWTAuthentication(BaseAuthentication):
    """
    Custom DRF authentication using JWT tokens.
    Extracts the token from the Authorization header (Bearer scheme).
    """

    def authenticate(self, request):
        """
        Authenticate the request using the JWT token in Authorization header.

        Returns:
            Tuple of (user, token_payload) if valid.
            None if no auth header present (allows AnonymousUser for public endpoints).

        Raises:
            AuthenticationFailed: If token is present but invalid.
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')

        if not auth_header:
            return None

        parts = auth_header.split(' ')
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        token = parts[1]
        payload = auth_service.validate_token(token)

        if payload is None:
            raise AuthenticationFailed('Invalid or expired token.')

        try:
            user = User.objects.get(id=payload['user_id'], is_active=True)
        except User.DoesNotExist:
            raise AuthenticationFailed('User not found or inactive.')

        return (user, payload)
