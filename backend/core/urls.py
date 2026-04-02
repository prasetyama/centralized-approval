"""
Core URL Configuration
=======================
API routes for the Centralized Approval Workflow engine.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from core.views import (
    WorkflowSubmitView, WorkflowDetailView,
    WorkflowApproveView, WorkflowRejectView, WorkflowReviseView, WorkflowDelegateView,
    InboxView, HistoryView, dashboard_summary,
    ModuleViewSet, RoleViewSet, UserViewSet,
    WorkflowDefinitionViewSet, ApprovalRequestViewSet,
)

router = DefaultRouter()
router.register(r'admin/modules', ModuleViewSet, basename='module')
router.register(r'admin/roles', RoleViewSet, basename='role')
router.register(r'admin/users', UserViewSet, basename='user')
router.register(r'admin/workflows', WorkflowDefinitionViewSet, basename='workflow-definition')
router.register(r'requests', ApprovalRequestViewSet, basename='approval-request')

urlpatterns = [
    # Workflow actions
    path('workflow/submit', WorkflowSubmitView.as_view(), name='workflow-submit'),
    path('workflow/<int:pk>', WorkflowDetailView.as_view(), name='workflow-detail'),
    path('workflow/<int:pk>/approve', WorkflowApproveView.as_view(), name='workflow-approve'),
    path('workflow/<int:pk>/reject', WorkflowRejectView.as_view(), name='workflow-reject'),
    path('workflow/<int:pk>/revise', WorkflowReviseView.as_view(), name='workflow-revise'),
    path('workflow/<int:pk>/delegate', WorkflowDelegateView.as_view(), name='workflow-delegate'),

    # Inbox & History
    path('inbox', InboxView.as_view(), name='inbox'),
    path('history', HistoryView.as_view(), name='history'),

    # Dashboard
    path('dashboard/summary', dashboard_summary, name='dashboard-summary'),

    # Admin CRUD (via router)
    path('', include(router.urls)),
]
