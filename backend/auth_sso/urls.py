"""
Auth SSO URL Configuration
===========================
"""
from django.urls import path
from auth_sso.views import login_view, logout_view, me_view

urlpatterns = [
    path('login', login_view, name='auth-login'),
    path('logout', logout_view, name='auth-logout'),
    path('me', me_view, name='auth-me'),
]
