"""
Core Views
==========
API views for the Centralized Approval Workflow engine.
All views use the WorkflowEngine for business logic (DRY principle).
"""
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from django.db.models import Q, Count
from django_filters.rest_framework import DjangoFilterBackend

from core.models import (
    Module, Role, User, WorkflowDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, WorkflowStepDefinition
)
from core.serializers import (
    ModuleSerializer, RoleSerializer, UserListSerializer, UserDetailSerializer,
    WorkflowDefinitionSerializer, WorkflowDefinitionWriteSerializer,
    ApprovalRequestListSerializer, ApprovalRequestDetailSerializer,
    SubmitRequestSerializer, ActionSerializer, AuditLogSerializer,
    DelegateRequestSerializer,
)
from core.engine import WorkflowEngine


def _get_client_ip(request):
    """Extract client IP from request headers."""
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


# ─────────────────────────────────────────────
# Workflow Submit & Action Endpoints
# ─────────────────────────────────────────────

class WorkflowSubmitView(generics.CreateAPIView):
    """
    POST /api/v1/workflow/submit
    Submit a new approval request from any external module.

    Accepts the module code, workflow ID, title, payload, and optional fields.
    The WorkflowEngine handles all creation logic, step generation, and audit logging.
    """
    serializer_class = SubmitRequestSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approval_request = WorkflowEngine.submit_request(
            module_code=serializer.validated_data['module_code'],
            workflow_id=serializer.validated_data['workflow_id'],
            requester=request.user,
            title=serializer.validated_data['title'],
            payload=serializer.validated_data['payload'],
            description=serializer.validated_data.get('description', ''),
            priority=serializer.validated_data.get('priority', 'MEDIUM'),
            reference_id=serializer.validated_data.get('reference_id', ''),
            ip_address=_get_client_ip(request),
        )

        return Response(
            {
                'success': True,
                'data': ApprovalRequestDetailSerializer(approval_request).data,
                'message': 'Approval request submitted successfully.',
            },
            status=status.HTTP_201_CREATED
        )


class WorkflowDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/workflow/<id>
    Get detailed view of an approval request including steps and audit trail.
    """
    queryset = ApprovalRequest.objects.select_related(
        'module', 'workflow', 'requester'
    ).prefetch_related('steps', 'audit_logs')
    serializer_class = ApprovalRequestDetailSerializer
    permission_classes = [IsAuthenticated]


class WorkflowApproveView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/approve
    Approve the current step of an approval request.
    """
    serializer_class = ActionSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approval_request = WorkflowEngine.approve_step(
            request_id=pk,
            approver=request.user,
            comments=serializer.validated_data.get('comments', ''),
            ip_address=_get_client_ip(request),
        )

        return Response({
            'success': True,
            'data': ApprovalRequestDetailSerializer(approval_request).data,
            'message': 'Step approved successfully.',
        })


class WorkflowRejectView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/reject
    Reject the current step and the entire request.
    """
    serializer_class = ActionSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        approval_request = WorkflowEngine.reject_step(
            request_id=pk,
            approver=request.user,
            comments=serializer.validated_data.get('comments', ''),
            ip_address=_get_client_ip(request),
        )

        return Response({
            'success': True,
            'data': ApprovalRequestDetailSerializer(approval_request).data,
            'message': 'Request rejected.',
        })


class WorkflowReviseView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/revise
    Revise a rejected request with optional updated payload.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        updated_payload = request.data.get('payload')

        approval_request = WorkflowEngine.revise_request(
            request_id=pk,
            requester=request.user,
            updated_payload=updated_payload,
            ip_address=_get_client_ip(request),
        )

        return Response({
            'success': True,
            'data': ApprovalRequestDetailSerializer(approval_request).data,
            'message': 'Request revised and resubmitted.',
        })


class WorkflowDelegateView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/delegate
    Delegate/reassign the current step to another user.
    """
    serializer_class = DelegateRequestSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_superuser:
            return Response({'error': 'Only superusers can delegate steps.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            new_assignee = User.objects.get(id=serializer.validated_data['new_assignee_id'])
        except User.DoesNotExist:
            return Response({'error': 'New assignee not found.'}, status=status.HTTP_404_NOT_FOUND)

        approval_request = WorkflowEngine.delegate_step(
            request_id=pk,
            current_user=request.user,
            new_assignee=new_assignee,
            comments=serializer.validated_data.get('comments', ''),
            ip_address=_get_client_ip(request),
        )

        return Response({
            'success': True,
            'data': ApprovalRequestDetailSerializer(approval_request).data,
            'message': f'Step delegated to {new_assignee.username}.',
        })


# ─────────────────────────────────────────────
# Inbox Endpoint
# ─────────────────────────────────────────────

class InboxView(generics.ListAPIView):
    """
    GET /api/v1/inbox
    Unified inbox: returns all approval tasks "Waiting for Me" across all modules.
    Supports filtering by module, priority, and search.
    """
    serializer_class = ApprovalRequestListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Return requests where the current user has a WAITING step assigned.
        Also includes requests where the step's required role matches the user's role
        and no specific assignee is set.
        """
        user = self.request.user

        if (user.is_superuser):
            request_ids = ApprovalStep.objects.filter(
            ).values_list('request_id', flat=True).distinct()
        else:
            # Requests where user is assigned or has the required role
            request_ids = ApprovalStep.objects.filter(
                status=ApprovalStep.StepStatus.WAITING
            ).filter(
            Q(assigned_to=user) |
            Q(assigned_to__isnull=True, role_required=user.role)
        ).values_list('request_id', flat=True).distinct()

        queryset = ApprovalRequest.objects.filter(
            id__in=request_ids,
            status=ApprovalRequest.Status.IN_PROGRESS,
        ).select_related('module', 'requester')

        # Filtering
        module_code = self.request.query_params.get('module')
        if module_code:
            queryset = queryset.filter(module__code=module_code)

        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(reference_id__icontains=search)
            )

        return queryset


# ─────────────────────────────────────────────
# History Endpoint
# ─────────────────────────────────────────────

class HistoryView(generics.ListAPIView):
    """
    GET /api/v1/history
    Unified history: returns all approval tasks the user has approved or rejected.
    Supports filtering by module, priority, and search.
    """
    serializer_class = ApprovalRequestListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        relevant_module_ids = WorkflowStepDefinition.objects.filter(
            role_required=user.role
        ).values_list('workflow__module_id', flat=True).distinct()

        # Requests where user is the actor for APPROVED or REJECTED actions
        request_ids = AuditLog.objects.filter(
            Q(request__module_id__in=relevant_module_ids) | Q(request__requester=user),
            step__role_required=user.role,
            action__in=[AuditLog.Action.APPROVED, AuditLog.Action.REJECTED]
        ).values_list('request_id', flat=True).distinct()

        queryset = ApprovalRequest.objects.filter(
            id__in=request_ids
        ).select_related('module', 'requester')

        # Filtering
        module_code = self.request.query_params.get('module')
        if module_code:
            queryset = queryset.filter(module__code=module_code)

        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(reference_id__icontains=search)
            )

        return queryset


# ─────────────────────────────────────────────
# Dashboard Summary
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    """
    GET /api/v1/dashboard/summary
    Returns aggregated counts for the dashboard.
    """
    user = request.user

    # Count all requests by status
    status_counts = dict(
        ApprovalRequest.objects.values_list('status')
        .annotate(count=Count('id'))
        .values_list('status', 'count')
    )

    # Pending for current user (inbox count)
    inbox_count = ApprovalStep.objects.filter(
        status=ApprovalStep.StepStatus.WAITING
    ).filter(
        Q(assigned_to=user) |
        Q(assigned_to__isnull=True, role_required=user.role)
    ).values_list('request_id', flat=True).distinct().count()

    # My submitted requests
    my_requests_count = ApprovalRequest.objects.filter(requester=user).count()

    # Recent activity (last 10 audit logs)
    if user.is_superuser:
        recent_logs = AuditLog.objects.all()
    else:
        # Modules where the user's role is an approver
        relevant_module_ids = WorkflowStepDefinition.objects.filter(
            role_required=user.role
        ).values_list('workflow__module_id', flat=True).distinct()
        
        recent_logs = AuditLog.objects.filter(
            Q(request__module_id__in=relevant_module_ids) | Q(request__requester=user)
        ).distinct()
    recent_logs = recent_logs.select_related('request', 'actor', 'request__module')[:10]
    activity_serializer = AuditLogSerializer(recent_logs, many=True)

    # Module counts
    module_counts = [
        {'code': m['code'], 'name': m['name'], 'count': m['request_count']}
        for m in Module.objects.annotate(request_count=Count('approval_requests')).values('code', 'name', 'request_count')
    ]

    return Response({
        'success': True,
        'data': {
            'status_counts': {
                'draft': status_counts.get('DRAFT', 0),
                'pending': status_counts.get('PENDING', 0),
                'in_progress': status_counts.get('IN_PROGRESS', 0),
                'approved': status_counts.get('APPROVED', 0),
                'rejected': status_counts.get('REJECTED', 0),
                'revised': status_counts.get('REVISED', 0),
            },
            'inbox_count': inbox_count,
            'my_requests_count': my_requests_count,
            'recent_activity': activity_serializer.data,
            'module_counts': module_counts
        }
    })


# ─────────────────────────────────────────────
# Admin CRUD ViewSets
# ─────────────────────────────────────────────

class ModuleViewSet(viewsets.ModelViewSet):
    """CRUD for Modules."""
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']


class RoleViewSet(viewsets.ModelViewSet):
    """CRUD for Roles."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code']


class UserViewSet(viewsets.ModelViewSet):
    """CRUD for Users."""
    queryset = User.objects.select_related('role').all()
    permission_classes = [IsAuthenticated]
    search_fields = ['username', 'first_name', 'last_name', 'email']
    filterset_fields = ['role', 'is_active', 'is_approver']

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        return UserDetailSerializer


class WorkflowDefinitionViewSet(viewsets.ModelViewSet):
    """CRUD for WorkflowDefinitions (Admin)."""
    queryset = WorkflowDefinition.objects.select_related('module').prefetch_related('steps').all()
    permission_classes = [IsAuthenticated]
    filterset_fields = ['module', 'is_active']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return WorkflowDefinitionWriteSerializer
        return WorkflowDefinitionSerializer


class ApprovalRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for listing/retrieving all approval requests (Admin view)."""
    queryset = ApprovalRequest.objects.select_related(
        'module', 'workflow', 'requester'
    ).prefetch_related('steps', 'audit_logs').all()
    permission_classes = [IsAuthenticated]
    filterset_fields = {
        'module__code': ['exact'],
        'status': ['exact'],
        'updated_at': ['gt', 'gte'],
    }
    search_fields = ['title', 'reference_id']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ApprovalRequestDetailSerializer
        return ApprovalRequestListSerializer
