"""
Core URL Configuration
=======================
API routes for the Centralized Approval Workflow engine.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from core.views import (
    WorkflowSubmitView, SendEorderCCNotificationView, WorkflowDetailView,
    WorkflowApproveView, WorkflowRejectView, WorkflowReviseView, WorkflowDelegateView,
    WatcherListView, WatcherRemoveView,
    InboxView, HistoryView, dashboard_summary,
    ModuleViewSet, RoleViewSet, UserViewSet, DivisionViewSet, DepartmentViewSet,
    CompanyViewSet, OrganizationStructureViewSet,
    WorkflowDefinitionViewSet, ApprovalRequestViewSet, RequestFeedbackViewSet,
    BrandViewSet, UserBrandViewSet, MasterWorkflowCriteriaViewSet,
    ModuleVariableViewSet, CCEmailConfigViewSet, system_logs,
    PRNonTradeViewSet, MasterAssetViewSet, MasterWBSViewSet,
    MasterEquipmentViewSet, MasterGoodsViewSet
)

router = DefaultRouter()
router.register(r'admin/companies', CompanyViewSet, basename='company')
router.register(r'admin/org-structures', OrganizationStructureViewSet, basename='org-structure')
router.register(r'admin/departments', DepartmentViewSet, basename='department')
router.register(r'admin/divisions', DivisionViewSet, basename='division')
router.register(r'admin/modules', ModuleViewSet, basename='module')
router.register(r'admin/roles', RoleViewSet, basename='role')
router.register(r'admin/users', UserViewSet, basename='user')
router.register(r'admin/workflows', WorkflowDefinitionViewSet, basename='workflow-definition')
router.register(r'requests', ApprovalRequestViewSet, basename='approval-request')
router.register(r'feedback', RequestFeedbackViewSet, basename='request-feedback')
router.register(r'admin/brands', BrandViewSet, basename='brand')
router.register(r'admin/user-brands', UserBrandViewSet, basename='user-brand')
router.register(r'admin/master-workflow-conditions', MasterWorkflowCriteriaViewSet, basename='master-condition')
router.register(r'admin/module-variables', ModuleVariableViewSet, basename='module-variable')
router.register(r'admin/cc-email-configs', CCEmailConfigViewSet, basename='cc-email-config')
router.register(r'pr-non-trade', PRNonTradeViewSet, basename='pr-non-trade')
router.register(r'master/assets', MasterAssetViewSet, basename='master-asset')
router.register(r'master/wbs', MasterWBSViewSet, basename='master-wbs')
router.register(r'master/equipments', MasterEquipmentViewSet, basename='master-equipment')
router.register(r'master/goods', MasterGoodsViewSet, basename='master-goods')

urlpatterns = [
    # Module Variables (Direct access as per spec)
    path('modules/<int:pk>/variables', ModuleViewSet.as_view({'get': 'variables'}), name='module-variables-direct'),

    # Workflow actions
    path('workflow/submit', WorkflowSubmitView.as_view(), name='workflow-submit'),
    path('workflow/send-eorder-cc', SendEorderCCNotificationView.as_view(), name='workflow-send-eorder-cc'),
    path('workflow/<int:pk>', WorkflowDetailView.as_view(), name='workflow-detail'),
    path('workflow/<int:pk>/approve', WorkflowApproveView.as_view(), name='workflow-approve'),
    path('workflow/<int:pk>/reject', WorkflowRejectView.as_view(), name='workflow-reject'),
    path('workflow/<int:pk>/revise', WorkflowReviseView.as_view(), name='workflow-revise'),
    path('workflow/<int:pk>/delegate', WorkflowDelegateView.as_view(), name='workflow-delegate'),
    path('workflow/<int:pk>/watchers', WatcherListView.as_view(), name='workflow-watchers'),
    path('workflow/watchers/remove', WatcherRemoveView.as_view(), name='workflow-watchers-remove'),   

    # Inbox & History
    path('inbox', InboxView.as_view(), name='inbox'),
    path('history', HistoryView.as_view(), name='history'),

    # Dashboard
    path('dashboard/summary', dashboard_summary, name='dashboard-summary'),

    # Admin CRUD (via router)
    path('admin/system-logs', system_logs, name='system-logs'),
    path('', include(router.urls)),
]
