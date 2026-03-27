"""
Mock Auth Service
=================
Mock implementation of OAuth/OpenID Connect for development.
Issues JWT tokens and manages sessions.
"""
import jwt
import datetime
from typing import Optional
from django.conf import settings

from auth_sso.interfaces import AuthInterface, AuthResult
from core.models import User


class MockAuthService(AuthInterface):
    """
    Mock OAuth/OpenID Connect provider.
    Uses JWT tokens for session management.
    In production, this would be replaced with a real SSO provider
    (e.g., Keycloak, Auth0, Azure AD).
    """

    # In-memory blacklist for invalidated tokens (in production, use Redis)
    _blacklisted_tokens = set()

    def authenticate(self, username: str, password: str) -> AuthResult:
        """
        Authenticate user with username/password.
        Issues a JWT token on success.

        Args:
            username: User's username.
            password: User's password.

        Returns:
            AuthResult with JWT token if credentials are valid.
        """
        try:
            user = User.objects.get(username=username, is_active=True)
        except User.DoesNotExist:
            return AuthResult(success=False, error="Invalid username or password.")

        if not user.check_password(password):
            return AuthResult(success=False, error="Invalid username or password.")

        # Generate JWT token
        expiration_hours = getattr(settings, 'JWT_EXPIRATION_HOURS', 24)
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=expiration_hours)

        payload = {
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role.code if user.role else None,
            'is_approver': user.is_approver,
            'exp': expires_at,
            'iat': datetime.datetime.now(datetime.timezone.utc),
        }

        token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY,
            algorithm='HS256'
        )

        return AuthResult(
            success=True,
            user_id=user.id,
            token=token,
            expires_in=expiration_hours * 3600,
        )

    def validate_token(self, token: str) -> Optional[dict]:
        """
        Validate JWT token and return decoded payload.

        Args:
            token: JWT token string.

        Returns:
            Decoded token payload dict, or None if invalid.
        """
        if token in self._blacklisted_tokens:
            return None

        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=['HS256']
            )
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

    def logout(self, token: str) -> bool:
        """
        Invalidate token by adding to blacklist.

        Args:
            token: Token to invalidate.

        Returns:
            Always True.
        """
        self._blacklisted_tokens.add(token)
        return True


# Singleton instance
auth_service = MockAuthService()
