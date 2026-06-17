import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from auth_sso.authentication import JWTAuthentication
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
request = factory.get('/')

# Mock a payload since we can't fully validate
class MockAuthService:
    def validate_token(self, token):
        return {
            'email': 'newuser123@example.com',
            'name': 'New User',
            'department': 'IT',
            'title': 'SPV',
            'module_roles': {'APPROVAL': 'approval'}
        }

import auth_sso.authentication
auth_sso.authentication.auth_service = MockAuthService()

request.META['HTTP_AUTHORIZATION'] = 'Bearer dummy'
auth = JWTAuthentication()
try:
    user, payload = auth.authenticate(request)
    print("User authenticated successfully!", user.username)
except Exception as e:
    import traceback
    traceback.print_exc()

