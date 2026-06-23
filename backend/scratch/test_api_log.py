import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from core.middleware import APIAuditMiddleware
from django.http import JsonResponse
from core.models import APIAuditLog

def dummy_get_response(request):
    if request.path.startswith('/api/v1/error'):
        return JsonResponse({'error': 'Intentional failure'}, status=400)
    return JsonResponse({'status': 'ok'})

factory = RequestFactory()
request = factory.post(
    '/api/v1/test_login', 
    data=json.dumps({'username': 'test', 'password': 'mypassword123'}),
    content_type='application/json'
)

middleware = APIAuditMiddleware(dummy_get_response)
response = middleware(request)

print("Response Status:", response.status_code)

log = APIAuditLog.objects.order_by('-id').first()
if log:
    print("Logged Endpoint:", log.endpoint)
    print("Logged Method:", log.method)
    print("Logged Payload:", log.payload)
    print("Execution Time:", log.execution_time_ms)
else:
    print("NO LOG CREATED")
