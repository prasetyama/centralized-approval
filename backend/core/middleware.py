import time
import json
import logging
from django.utils.deprecation import MiddlewareMixin
from core.models import APIAuditLog

logger = logging.getLogger(__name__)

class APIAuditMiddleware(MiddlewareMixin):
    """
    Middleware to log all API requests and their responses.
    """

    def process_request(self, request):
        request._start_time = time.time()
        # Read and cache the body so it can be parsed later without consuming the stream
        try:
            request._body_cache = request.body
        except Exception:
            request._body_cache = b''

    def _scrub_payload(self, payload):
        """
        Recursively scrub sensitive fields like passwords from the payload.
        """
        if isinstance(payload, dict):
            scrubbed = {}
            for key, value in payload.items():
                if key.lower() in ['password', 'pwd', 'pass', 'secret', 'token']:
                    scrubbed[key] = '*** SCRUBBED ***'
                else:
                    scrubbed[key] = self._scrub_payload(value)
            return scrubbed
        elif isinstance(payload, list):
            return [self._scrub_payload(item) for item in payload]
        return payload

    def process_response(self, request, response):
        path = request.path

        # Only log requests to /api/
        if not path.startswith('/api/'):
            return response

        # Do not log health checks
        if path.startswith('/api/v1/health'):
            return response

        execution_time_ms = (time.time() - getattr(request, '_start_time', time.time())) * 1000

        # Extract Payload
        payload = None
        if hasattr(request, '_body_cache') and request._body_cache:
            try:
                raw_payload = json.loads(request._body_cache.decode('utf-8'))
                # If it's a login endpoint, we only want the login time and username, scrub password
                payload = self._scrub_payload(raw_payload)
            except Exception:
                # If not JSON, save raw string (truncated if too long)
                raw_string = request._body_cache.decode('utf-8', errors='ignore')
                payload = {'raw_data': raw_string[:1000] + ('...' if len(raw_string) > 1000 else '')}

        # Extract Error Message
        error_message = None
        if response.status_code >= 400:
            if hasattr(response, 'data'):
                # DRF responses usually have .data
                error_message = str(response.data)
            elif hasattr(response, 'content'):
                try:
                    error_message = response.content.decode('utf-8')
                except Exception:
                    error_message = "Could not decode error response"

        # Extract User
        user = getattr(request, 'user', None)
        if user and not user.is_authenticated:
            user = None

        # Extract IP Address
        def get_client_ip(req):
            x_forwarded_for = req.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                return x_forwarded_for.split(',')[0]
            return req.META.get('REMOTE_ADDR')

        try:
            APIAuditLog.objects.create(
                user=user,
                endpoint=path,
                method=request.method,
                payload=payload,
                response_status=response.status_code,
                error_message=error_message,
                ip_address=get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')[:500], # Safely truncate
                execution_time_ms=execution_time_ms
            )
        except Exception as e:
            # If logging fails, we don't want to crash the API request itself
            logger.error(f"Failed to save APIAuditLog: {e}", exc_info=True)

        return response
