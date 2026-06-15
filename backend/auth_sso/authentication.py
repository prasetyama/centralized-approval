"""
JWT Authentication Backend
===========================
DRF authentication class that integrates with MockAuthService.
"""
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from core.models import User, Role
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

        # Extract email from payload
        email = payload.get('email')
        if not email:
            raise AuthenticationFailed('Token does not contain email.')

        try:
            user = User.objects.get(email=email, is_active=True)
            
            # Optionally update role and department from SSO
            module_roles = payload.get('module_roles', {})
            role_code = module_roles.get('approval') or module_roles.get('APPROVAL')
            if role_code and (not user.role or user.role.code.lower() != role_code.lower()):
                
                role = Role.objects.filter(code__iexact=role_code).first()
                if role:
                    user.role = role
                    user.is_approver = True
                    user.save(update_fields=['role', 'is_approver'])

        except User.DoesNotExist:
            
            # Extract role
            module_roles = payload.get('module_roles', {})
            role_code = module_roles.get('approval') or module_roles.get('APPROVAL')
            role = None
            if role_code:
                role = Role.objects.filter(code__iexact=role_code).first()

            # Create username
            username = email.split('@')[0]
            original_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{original_username}{counter}"
                counter += 1
            
            # Extract name
            name = payload.get('name', '')
            parts = name.split(' ')
            first_name = parts[0] if parts else ''
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

            user = User.objects.create(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=role,
                department=payload.get('department', ''),
                is_active=True,
                is_approver=True if role else False
            )

        return (user, payload)
