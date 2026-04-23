"""
JWT Authentication Backend
===========================
DRF authentication class that integrates with MockAuthService.
"""
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from core.models import User
from auth_sso.services import auth_service


class JWTAuthentication(BaseAuthentication):
    """
    Custom DRF authentication using JWT tokens.
    Extracts the token from the Authorization header (Bearer scheme).
    Supports JIT (Just-In-Time) user provisioning for SSO.
    """

    def authenticate(self, request):
        """
        Authenticate the request using the JWT token in Authorization header.
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

        # Extract user identification from payload
        # SSO tokens usually have 'username' or 'email'
        username = payload.get('username') or payload.get('email')
        user_id = payload.get('user_id')

        if not username and not user_id:
            raise AuthenticationFailed('Token payload missing user identification.')

        try:
            if username:
                user = User.objects.get(username=username, is_active=True)
            else:
                user = User.objects.get(id=user_id, is_active=True)
                
            # Optional: Sync user info from payload if it has changed
            self._sync_user_with_payload(user, payload)
            
        except User.DoesNotExist:
            # JIT Provisioning for SSO users
            if username and getattr(settings, 'SSO_URL', None):
                user = self._provision_user(username, payload)
            else:
                raise AuthenticationFailed('User not found or inactive.')

        return (user, payload)

    def _sync_user_with_payload(self, user, payload):
        """Sync local user fields with info from SSO payload."""
        changed = False
        
        email = payload.get('email')
        if email and user.email != email:
            user.email = email
            changed = True
            
        # Add more fields if available in payload
        # first_name = payload.get('first_name')
        # if first_name and user.first_name != first_name:
        #     user.first_name = first_name
        #     changed = True
            
        if changed:
            user.save()

    def _provision_user(self, username, payload):
        """Create a new local user based on SSO data."""
        from core.models import Role
        
        email = payload.get('email', f"{username}@sso.local")
        role_code = payload.get('role', 'staff') # Default to staff
        
        try:
            role = Role.objects.get(code=role_code)
        except Role.DoesNotExist:
            role = Role.objects.filter(code='staff').first()

        user = User.objects.create(
            username=username,
            email=email,
            role=role,
            is_active=True,
            is_approver=payload.get('is_approver', False)
        )
        # Set a dummy password since it's SSO only
        user.set_unusable_password()
        user.save()
        return user
