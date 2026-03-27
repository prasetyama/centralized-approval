"""
URL configuration for Centralized Approval Workflow.
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('auth_sso.urls')),
    path('api/v1/', include('core.urls')),
]
