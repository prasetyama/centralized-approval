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
    """

    # In-memory blacklist for invalidated tokens (in production, use Redis)
    _blacklisted_tokens = set()

    def authenticate(self, username: str, password: str) -> AuthResult:
        """Authenticate user with username/password. Issues a JWT token on success."""
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
        """Validate JWT token and return decoded payload."""
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
        """Invalidate token by adding to blacklist."""
        self._blacklisted_tokens.add(token)
        return True


class ExternalSSOAuthService(MockAuthService):
    """
    Real SSO implementation that calls an external provider.
    Inherits local authentication from MockAuthService.
    """

    def validate_token(self, token: str) -> Optional[dict]:
        """
        Validate token: try local validation first, then external SSO.
        """
        # Try local validation first (for tokens issued via /login)
        payload = super().validate_token(token)
        if payload:
            return payload

        # If not a local token, try external SSO
        import json
        import urllib.request
        import urllib.error

        sso_url = getattr(settings, 'SSO_URL', None)
        if not sso_url:
            return None

        try:
            url = f"{sso_url}/api/validate-token"
            data = json.dumps({'token': token}).encode('utf-8')
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'}, method='POST')
            
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    res_data = json.loads(response.read().decode('utf-8'))
                    # Ensure we return a payload that has at least 'username'
                    return res_data.get('data') or res_data
            return None
        except urllib.error.HTTPError as e:
            print(f"SSO HTTP Error: {e.code} {e.reason}")
            return None
        except Exception as e:
            print(f"SSO Validation Error: {str(e)}")
            return None

    def logout(self, token: str) -> bool:
        # Handle logout if supported by external SSO
        return True


# Singleton instance initialization based on configuration
if getattr(settings, 'SSO_URL', None):
    auth_service = ExternalSSOAuthService()
else:
    auth_service = MockAuthService()
