"""
Custom Exception Handler
========================
Unified error response format for all API endpoints.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


import logging
logger = logging.getLogger(__name__)

def custom_exception_handler(exc, context):
    """
    Custom exception handler that wraps all errors in a consistent format.

    Response format:
    {
        "success": false,
        "error": {
            "code": "ERROR_CODE",
            "message": "Human readable message",
            "details": {}  // Optional
        }
    }
    """
    response = exception_handler(exc, context)

    if response is not None:
        error_data = {
            'success': False,
            'error': {
                'code': _get_error_code(response.status_code),
                'message': _extract_message(response.data),
                'details': response.data if isinstance(response.data, dict) else None,
            }
        }
        response.data = error_data
    else:
        # Unhandled exception
        logger.error("Unhandled API Exception:", exc_info=exc)
        error_data = {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'An unexpected error occurred.',
                'details': None,
            }
        }
        response = Response(error_data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response


def _get_error_code(status_code):
    """Map HTTP status codes to error code strings."""
    mapping = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        405: 'METHOD_NOT_ALLOWED',
        409: 'CONFLICT',
        422: 'VALIDATION_ERROR',
        429: 'RATE_LIMIT_EXCEEDED',
        500: 'INTERNAL_SERVER_ERROR',
    }
    return mapping.get(status_code, 'UNKNOWN_ERROR')


def _extract_message(data):
    """Extract a human-readable message from DRF error data."""
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        # Collect field errors
        messages = []
        for field, errors in data.items():
            if isinstance(errors, list):
                messages.append(f"{field}: {', '.join(str(e) for e in errors)}")
            else:
                messages.append(f"{field}: {errors}")
        return '; '.join(messages) if messages else 'Validation error'
    if isinstance(data, list):
        return '; '.join(str(e) for e in data)
    return str(data)
