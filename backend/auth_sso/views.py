"""
Auth SSO Views
==============
Login, logout, and user info endpoints.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from auth_sso.services import auth_service
from core.serializers import UserDetailSerializer


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    POST /api/v1/auth/login
    Authenticate user and return JWT token.

    Request body:
        - username (str): Username.
        - password (str): Password.

    Returns:
        - token (str): JWT access token.
        - user (dict): User info.
        - expires_in (int): Token expiry in seconds.
    """
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response(
            {'success': False, 'error': {'message': 'Username and password are required.'}},
            status=status.HTTP_400_BAD_REQUEST
        )

    result = auth_service.authenticate(username, password)

    if not result.success:
        return Response(
            {'success': False, 'error': {'message': result.error}},
            status=status.HTTP_401_UNAUTHORIZED
        )

    from core.models import User
    user = User.objects.prefetch_related('user_roles__role').get(id=result.user_id)

    return Response({
        'success': True,
        'data': {
            'token': result.token,
            'expires_in': result.expires_in,
            'user': UserDetailSerializer(user).data,
        }
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    POST /api/v1/auth/logout
    Invalidate the current JWT token.
    """
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        auth_service.logout(token)

    return Response({
        'success': True,
        'message': 'Logged out successfully.'
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """
    GET /api/v1/auth/me
    Get current authenticated user information.
    """
    user = request.user
    return Response({
        'success': True,
        'data': UserDetailSerializer(user).data,
    })
