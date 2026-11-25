"""
Core Views
==========
API views for the Centralized Approval Workflow engine.
All views use the WorkflowEngine for business logic (DRY principle).
"""
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Q, Prefetch, Count
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
import logging
import csv
import io
import os
import re
import urllib.parse
import requests
from django.conf import settings
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleAuthRequest
import openpyxl


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 1000


class PRNonTradePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'limit'
    max_page_size = 1000

    def get_page_size(self, request):
        for param in ('limit', 'page_size'):
            if param in request.query_params:
                try:
                    val = int(request.query_params[param])
                    if val > 0:
                        return min(val, self.max_page_size)
                except (KeyError, ValueError, TypeError):
                    pass
        return self.page_size

from core.models import (
    Module, Role, User, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, Division, Department, RequestFeedback,
    Company, OrganizationStructure, Brand, UserBrand, MasterWorkflowCriteria, RequestWatcher, ModuleVariable,
    CCEmailConfig, MasterAsset, MasterWBS, MasterEquipment, MasterGoods,
    MasterCarNumber,
    PRNonTrade, PRNonTradeItem, PRNonTradeSequence
)
from core.serializers import (
    ModuleSerializer, RoleSerializer, UserListSerializer, UserDetailSerializer,
    WorkflowDefinitionSerializer, WorkflowDefinitionWriteSerializer,
    WorkflowStepDefinitionSerializer, ApprovalRequestListSerializer,
    ApprovalRequestDetailSerializer, SubmitRequestSerializer,
    ApprovalStepSerializer, AuditLogSerializer, ActionSerializer,
    DivisionSerializer, DepartmentSerializer, CompanySerializer, OrganizationStructureSerializer,
    DelegateRequestSerializer, RequestFeedbackSerializer,
    BrandSerializer, UserBrandSerializer, MasterWorkflowCriteriaSerializer,
    RequestWatcherSerializer, ModuleVariableSerializer, CCEmailConfigSerializer,
    MasterAssetSerializer, MasterWBSSerializer, MasterEquipmentSerializer, MasterGoodsSerializer,
    MasterCarNumberSerializer,
    PRNonTradeSerializer, PRNonTradeItemSerializer
)
from core.engine import WorkflowEngine
from core import email_service
from django.utils import timezone
from rest_framework.decorators import action


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

        try:
            approval_request = WorkflowEngine.submit_request(
                module_code=serializer.validated_data['module_code'],
                workflow_id=serializer.validated_data['workflow_id'],
                requester=request.user,
                title=serializer.validated_data['title'],
                payload=serializer.validated_data['payload'],
                description=serializer.validated_data.get('description', ''),
                priority=serializer.validated_data.get('priority', 'MEDIUM'),
                reference_id=serializer.validated_data.get('reference_id', ''),
                division_id=serializer.validated_data.get('division_id'),
                ip_address=_get_client_ip(request),
                watcher_ids=serializer.validated_data.get('watcher_ids', []),
            )
        except Exception as e:
            # Catch any unexpected errors during submission (e.g., DataError, TypeError, KeyError)
            # and return them as a 400 Bad Request instead of a 500 Internal Server Error
            logging.getLogger(__name__).error("Submit workflow failed: %s", str(e), exc_info=True)
            raise ValidationError(f"Workflow submission failed: {str(e)}")

        return Response(
            {
                'success': True,
                'data': ApprovalRequestDetailSerializer(approval_request).data,
                'message': 'Approval request submitted successfully.',
            },
            status=status.HTTP_201_CREATED
        )


class SendEorderCCNotificationView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/send-eorder-cc
    POST /api/v1/workflow/<int:pk>/send-eorder-cc
    Send CC notification email for eOrder Information for a given request_id or reference_id.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        payload = request.data.get('payload')

        if not payload:
            return Response(
                {'success': False, 'message': 'payload must be provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            approval_request = WorkflowEngine.send_eorder_info_cc_notification(payload=payload)
            return Response(
                {
                    'success': True,
                    'message': f'eOrder Information CC notification email sent successfully.',
                    'data': {
                        'payload': payload
                    }
                },
                status=status.HTTP_200_OK
            )
        except ApprovalRequest.DoesNotExist:
            return Response(
                {'success': False, 'message': 'Approval request not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logging.getLogger(__name__).error("Send eOrder CC notification failed: %s", str(e), exc_info=True)
            return Response(
                {'success': False, 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class WorkflowDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/workflow/<id>
    Get detailed view of an approval request including steps and audit trail.
    """
    queryset = ApprovalRequest.objects.select_related(
        'module', 'workflow', 'requester'
    ).prefetch_related(
        Prefetch('steps', queryset=ApprovalStep.objects.exclude(status='ADDITIONAL').select_related('locked_by')),
        'audit_logs',
        Prefetch('watchers', queryset=RequestWatcher.objects.filter(deleted_at=None).select_related('user'))
    )
    serializer_class = ApprovalRequestDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """
        Allow access if user is requester, an approver in any step, or a watcher.
        """
        user = self.request.user
        if user.is_superuser:
            return self.queryset

        dept_ids = user.get_department_ids() if hasattr(user, 'get_department_ids') else []
        try:
            request_obj = self.queryset.filter(
                Q(requester=user) |
                Q(steps__assigned_to=user) |
                Q(steps__approver_type='TARGET_DEPT_ROLE', steps__target_department_id__in=dept_ids) |
                (Q(watchers__user=user) & Q(watchers__deleted_at=None))
            ).distinct()
            if not request_obj.exists():
                logging.getLogger(__name__).error(
                    "[Core.Views] User %s not authorized to view workflow %s", 
                    self.request.user.username, self.kwargs.get('pk')
                )
                raise ValidationError("You are not authorized to view this request.")
            return request_obj
        except Exception as e:
            if isinstance(e, ValidationError):
                raise
            logging.getLogger(__name__).error(
                "[Core.Views] Error in get_queryset for user %s and request %s", 
                self.request.user.username, self.kwargs.get('pk')
            )
            raise ValidationError("You are not authorized to view this request.")


class WorkflowStepLockView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/lock
        Acquire/renew lease lock on the active step (or unlock if {"action": "unlock"}).
    DELETE /api/v1/workflow/<id>/lock
        Release lease lock on the active step if held by request.user.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        action_type = (request.data.get('action') or 'lock').strip().lower()
        if action_type == 'unlock':
            WorkflowEngine.release_step_lock(pk, request.user)
            return Response({
                'success': True,
                'data': {'unlocked': True},
            })

        acquired, step = WorkflowEngine.acquire_step_lock(pk, request.user, ttl_seconds=120)
        is_locked = step.is_actively_locked() if step else False
        is_locked_by_other = step.is_locked_by_other(request.user) if step else False
        locked_by_user = step.locked_by if (is_locked and step) else None

        return Response({
            'success': True,
            'data': {
                'acquired': acquired,
                'is_locked': is_locked,
                'is_locked_by_other': is_locked_by_other,
                'locked_by': locked_by_user.id if locked_by_user else None,
                'locked_by_name': (locked_by_user.get_full_name() or locked_by_user.username) if locked_by_user else None,
                'locked_by_email': locked_by_user.email if locked_by_user else None,
                'locked_at': step.locked_at if is_locked else None,
                'lock_expires_at': step.lock_expires_at if is_locked else None,
            },
        })

    def delete(self, request, pk):
        WorkflowEngine.release_step_lock(pk, request.user)
        return Response({
            'success': True,
            'data': {'unlocked': True},
        })


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

        dlvdate = serializer.validated_data.get('dlvdate') or serializer.validated_data.get('dlv_date') or None
        step_data = serializer.validated_data.get('step_data') or {}
        
        # Merge individual fields if present
        if serializer.validated_data.get('po_number'):
            step_data['po_number'] = serializer.validated_data['po_number']
        if serializer.validated_data.get('pr_number'):
            step_data['pr_number'] = serializer.validated_data['pr_number']
        if serializer.validated_data.get('quotation'):
            step_data['quotation'] = serializer.validated_data['quotation']
        if serializer.validated_data.get('approval_quotation'):
            step_data['approval_quotation'] = serializer.validated_data['approval_quotation']
        if serializer.validated_data.get('use_adhoc'):
            step_data['use_adhoc'] = serializer.validated_data['use_adhoc']
        if serializer.validated_data.get('adhoc_approver_id'):
            step_data['adhoc_approver_id'] = serializer.validated_data['adhoc_approver_id']
        if serializer.validated_data.get('adhoc_step_name'):
            step_data['adhoc_step_name'] = serializer.validated_data['adhoc_step_name']
        if serializer.validated_data.get('adhoc_notes'):
            step_data['adhoc_notes'] = serializer.validated_data['adhoc_notes']

        try:
            approval_request = WorkflowEngine.approve_step(
                request_id=pk,
                approver=request.user,
                comments=serializer.validated_data.get('comments', ''),
                ip_address=_get_client_ip(request),
                dlvdate=dlvdate,
                step_data=step_data,
            )
        except Exception as e:
            logging.getLogger(__name__).error(
                "[Core.Views] User %s not authorized to approve workflow %s: %s", 
                self.request.user.username, self.kwargs.get('pk'), str(e)
            )
            raise ValidationError(f"You are not authorized to approve this request or an error occurred: {str(e)}")

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

        try:
            approval_request = WorkflowEngine.reject_step(
                request_id=pk,
                approver=request.user,
                comments=serializer.validated_data.get('comments', ''),
                ip_address=_get_client_ip(request),
            )
        except Exception as e:
            logging.getLogger(__name__).error(
                "[Core.Views] Failed to reject workflow %s by user %s: %s", 
                pk, request.user.username, str(e), exc_info=True
            )
            raise ValidationError(f"You are not authorized to reject this request or an error occurred: {str(e)}")

        return Response({
            'success': True,
            'data': ApprovalRequestDetailSerializer(approval_request).data,
            'message': 'Request rejected.',
        })


class WorkflowReviseView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/revise
    - If request status is IN_PROGRESS: Revises current step back to upload quotation.
    - If request status is REJECTED: Resubmits revised payload by original requester.
    """
    serializer_class = ActionSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            req_obj = ApprovalRequest.objects.get(id=pk)
        except ApprovalRequest.DoesNotExist:
            raise ValidationError(f"Approval request {pk} not found.")

        if req_obj.status == ApprovalRequest.Status.IN_PROGRESS:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            comments = serializer.validated_data.get('comments', '')
            if not comments.strip():
                raise ValidationError("Revision comments are required.")

            try:
                approval_request = WorkflowEngine.revise_step(
                    request_id=pk,
                    approver=request.user,
                    comments=comments,
                    ip_address=_get_client_ip(request),
                )
            except Exception as e:
                logging.getLogger(__name__).error(
                    "[Core.Views] Failed to revise workflow %s by user %s: %s",
                    pk, request.user.username, str(e), exc_info=True
                )
                raise ValidationError(f"Failed to revise request: {str(e)}")

            return Response({
                'success': True,
                'data': ApprovalRequestDetailSerializer(approval_request).data,
                'message': (
                    'Request successfully returned to the requester for PR form revision.'
                    if approval_request.status == ApprovalRequest.Status.REVISED
                    else 'Request successfully returned to quotation upload step for revision.'
                ),
            })
        elif req_obj.status in (ApprovalRequest.Status.REJECTED, ApprovalRequest.Status.REVISED):
            updated_payload = request.data.get('payload')
            try:
                approval_request = WorkflowEngine.revise_request(
                    request_id=pk,
                    requester=request.user,
                    updated_payload=updated_payload,
                    ip_address=_get_client_ip(request),
                )
            except Exception as e:
                logging.getLogger(__name__).error(
                    "[Core.Views] Failed to resubmit revised workflow %s by user %s: %s",
                    pk, request.user.username, str(e), exc_info=True
                )
                raise ValidationError(f"Failed to submit revision: {str(e)}")

            return Response({
                'success': True,
                'data': ApprovalRequestDetailSerializer(approval_request).data,
                'message': 'Request revised and resubmitted.',
            })
        else:
            raise ValidationError(f"Cannot revise request in status '{req_obj.status}'.")


class WorkflowDelegateView(generics.GenericAPIView):
    """
    POST /api/v1/workflow/<id>/delegate
    Redirect/reassign the current active approval step to another user (Admin only).
    """
    serializer_class = DelegateRequestSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not request.user.is_superuser:
            logging.getLogger(__name__).error("[Core.Views] Unauthorized redirect for workflow id %s by user %s", pk, request.user.username)
            return Response({'error': 'Only admin users can redirect approval steps.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            new_assignee = User.objects.get(id=serializer.validated_data['new_assignee_id'])
        except User.DoesNotExist as e:
            logging.getLogger(__name__).error("[Core.Views] New assignee not found: %s", str(e), exc_info=True)
            return Response({'error': 'New assignee not found.'}, status=status.HTTP_404_NOT_FOUND)

        approval_request = WorkflowEngine.delegate_step(
            request_id=pk,
            current_user=request.user,
            new_assignee=new_assignee,
            comments=serializer.validated_data.get('comments', ''),
            ip_address=_get_client_ip(request),
        )

        new_assignee_name = new_assignee.get_full_name() or new_assignee.username
        return Response({
            'success': True,
            'data': ApprovalRequestDetailSerializer(approval_request).data,
            'message': f'Approval step redirected to {new_assignee_name}.',
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
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        """
        Unified inbox: returns requests where the user is an active approver
        OR a participant in the discussion.
        """
        user = self.request.user
        tab = self.request.query_params.get('tab', 'inbox')

        try:
            if user.is_superuser:
                queryset = ApprovalRequest.objects.all()
            elif tab == 'watching':
                watched_ids = RequestWatcher.objects.filter(
                    user=user,
                    deleted_at=None
                ).values_list('request_id', flat=True)
                queryset = ApprovalRequest.objects.filter(id__in=watched_ids)
            else:
                dept_ids = user.get_department_ids() if hasattr(user, 'get_department_ids') else []

                # 1. Requests where user is the active approver or member of target department
                waiting_ids = ApprovalStep.objects.filter(
                    status=ApprovalStep.StepStatus.WAITING
                ).filter(
                    Q(assigned_to=user) |
                    Q(approver_type='REQUESTOR', request__requester=user) |
                    Q(approver_type='TARGET_DEPT_ROLE', target_department_id__in=dept_ids)
                ).values_list('request_id', flat=True)

                # 2. Requests where user has participated in the discussion
                discussion_ids = RequestFeedback.objects.filter(
                    user=user
                ).values_list('request_id', flat=True)

                # Combine all relevant request IDs
                all_ids = set(waiting_ids) | set(discussion_ids)

                queryset = ApprovalRequest.objects.filter(
                    id__in=all_ids,
                    status=ApprovalRequest.Status.IN_PROGRESS
                )

            queryset = queryset.select_related('module', 'requester').distinct()

            # Filtering
            module_code = self.request.query_params.get('module')
            if module_code:
                queryset = queryset.filter(module__code=module_code)

            priority = self.request.query_params.get('priority')
            if priority:
                queryset = queryset.filter(priority=priority)

            status_param = self.request.query_params.get('status')
            if status_param:
                queryset = queryset.filter(status=status_param)

            from django.utils.dateparse import parse_date
            from datetime import datetime as dt, time as dt_time

            start_date = self.request.query_params.get('start_date')
            if start_date:
                parsed_start = parse_date(start_date)
                if parsed_start:
                    dt_start = timezone.make_aware(dt.combine(parsed_start, dt_time.min))
                    queryset = queryset.filter(created_at__gte=dt_start)

            end_date = self.request.query_params.get('end_date')
            if end_date:
                parsed_end = parse_date(end_date)
                if parsed_end:
                    dt_end = timezone.make_aware(dt.combine(parsed_end, dt_time.max))
                    queryset = queryset.filter(created_at__lte=dt_end)

            search = self.request.query_params.get('search')
            if search:
                queryset = queryset.filter(
                    Q(title__icontains=search) |
                    Q(reference_id__icontains=search) |
                    Q(requester__first_name__icontains=search) |
                    Q(requester__last_name__icontains=search) |
                    Q(requester__username__icontains=search)
                )

            # Ordering / Sorting
            ordering = self.request.query_params.get('ordering')
            allowed_ordering = {
                'created_at': 'created_at',
                '-created_at': '-created_at',
                'title': 'title',
                '-title': '-title',
                'reference_id': 'reference_id',
                '-reference_id': '-reference_id',
                'status': 'status',
                '-status': '-status',
                'priority': 'priority',
                '-priority': '-priority',
                'module': 'module__name',
                '-module': '-module__name',
                'requester': 'requester__first_name',
                '-requester': '-requester__first_name',
            }
            if ordering and ordering in allowed_ordering:
                queryset = queryset.order_by(allowed_ordering[ordering])
            else:
                queryset = queryset.order_by('-created_at')

            return queryset

        except Exception as e:
            logging.getLogger(__name__).error(
                "[Core.Views] Error in InboxView get_queryset for user %s: %s", 
                user.username, str(e), exc_info=True
            )
            raise ValidationError(f"Failed to load inbox: {str(e)}")


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
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user

        try:
            # Requests where the logged-in user is the actor for APPROVED or REJECTED actions
            request_ids = AuditLog.objects.filter(
                actor=user,
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

            from django.utils.dateparse import parse_date
            from datetime import datetime as dt, time as dt_time

            start_date = self.request.query_params.get('start_date')
            if start_date:
                parsed_start = parse_date(start_date)
                if parsed_start:
                    dt_start = timezone.make_aware(dt.combine(parsed_start, dt_time.min))
                    queryset = queryset.filter(created_at__gte=dt_start)

            end_date = self.request.query_params.get('end_date')
            if end_date:
                parsed_end = parse_date(end_date)
                if parsed_end:
                    dt_end = timezone.make_aware(dt.combine(parsed_end, dt_time.max))
                    queryset = queryset.filter(created_at__lte=dt_end)

            search = self.request.query_params.get('search')
            if search:
                queryset = queryset.filter(
                    Q(title__icontains=search) |
                    Q(reference_id__icontains=search) |
                    Q(requester__first_name__icontains=search) |
                    Q(requester__last_name__icontains=search) |
                    Q(requester__username__icontains=search)
                )

            # Ordering / Sorting
            ordering = self.request.query_params.get('ordering')
            allowed_ordering = {
                'created_at': 'created_at',
                '-created_at': '-created_at',
                'title': 'title',
                '-title': '-title',
                'reference_id': 'reference_id',
                '-reference_id': '-reference_id',
                'status': 'status',
                '-status': '-status',
                'module': 'module__name',
                '-module': '-module__name',
                'requester': 'requester__first_name',
                '-requester': '-requester__first_name',
            }
            if ordering and ordering in allowed_ordering:
                queryset = queryset.order_by(allowed_ordering[ordering])
            else:
                queryset = queryset.order_by('-created_at')

            return queryset

        except Exception as e:
            logging.getLogger(__name__).error(
                "[Core.Views] Error in HistoryView get_queryset for user %s: %s", 
                user.username, str(e), exc_info=True
            )
            raise ValidationError(f"Failed to load history: {str(e)}")


class WatcherListView(generics.ListCreateAPIView):
    """
    GET /api/v1/workflow/<id>/watchers
    POST /api/v1/workflow/<id>/watchers
    List all watchers for a request or add a new one.
    """
    serializer_class = RequestWatcherSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RequestWatcher.objects.filter(request_id=self.kwargs['pk'], deleted_at=None)

    def post(self, request, pk):
        try:
            approval_request = ApprovalRequest.objects.get(id=pk)
        except ApprovalRequest.DoesNotExist:
            logging.getLogger(__name__).error(
                "[Core.Views] Request %s not found", pk
            )
            return Response({'error': 'Request not found.'}, status=status.HTTP_404_NOT_FOUND)

        user_id = request.data.get('user_id')
        if not user_id:
            logging.getLogger(__name__).error(
                "[Core.Views] user_id is required for request %s", pk
            )
            return Response({'error': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logging.getLogger(__name__).error(
                "[Core.Views] User %s not found", user_id
            )
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        existing_watcher = RequestWatcher.objects.filter(
            request=approval_request,
            user=target_user
        ).first()

        if existing_watcher:
            # If soft-deleted, restore it
            if existing_watcher.deleted_at is not None:
                existing_watcher.deleted_at = None
                existing_watcher.deleted_by = None
                existing_watcher.save()
                created = False
            else:
                created = False
            watcher = existing_watcher
        else:
            watcher = RequestWatcher.objects.create(
                request=approval_request,
                user=target_user,
                created_by=request.user
            )
            created = True

        if not created:
            logging.getLogger(__name__).info("[Core.Views] User is already a watcher: %s", request.user.username)
            return Response({'message': 'User is already a watcher.'}, status=status.HTTP_200_OK)

        # Audit log for adding watcher
        AuditLog.objects.create(
            request=approval_request,
            actor=request.user,
            action=AuditLog.Action.WATCHER_ADDED,
            details=f"Added {target_user.username} as a watcher.",
            payload_snapshot=approval_request.payload
        )

        return Response(RequestWatcherSerializer(watcher).data, status=status.HTTP_201_CREATED)

class WatcherRemoveView(generics.GenericAPIView):
    """
    DELETE /api/v1/workflow/watchers/remove
    Remove a watcher from a request using watcher_id in the request body.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        watcher_id = request.data.get('watcher_id')
        if not watcher_id:
            logging.getLogger(__name__).error("[Core.Views] Watcher ID is required: %s", request.user.username)
            return Response({'error': 'watcher_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            watcher = RequestWatcher.objects.get(id=watcher_id, deleted_at=None)
            
            if watcher.created_by != request.user and not request.user.is_superuser:
                logging.getLogger(__name__).warning("[Core.Views] Unauthorized watcher removal: %s", request.user.username)
                return Response({'error': 'You are not authorized to remove this watcher.'}, status=status.HTTP_403_FORBIDDEN)

            request_obj = watcher.request
            username = watcher.user.username
            
            watcher.deleted_at = timezone.now()
            watcher.deleted_by = request.user
            watcher.save()

            AuditLog.objects.create(
                request=request_obj,
                actor=request.user,
                action=AuditLog.Action.WATCHER_REMOVED,
                details=f"Removed {username} as a watcher.",
                payload_snapshot=request_obj.payload
            )

            return Response({'message': 'Watcher removed successfully.'})
        except RequestWatcher.DoesNotExist:
            logging.getLogger(__name__).error("[Core.Views] Watcher not found: %s", watcher_id)
            return Response({'error': 'Watcher not found.'}, status=status.HTTP_404_NOT_FOUND)


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

    try:
        dept_ids = user.get_department_ids() if hasattr(user, 'get_department_ids') else []

        # Count requests by status, filtered by user involvement
        if user.is_superuser:
            relevant_requests = ApprovalRequest.objects.all()
        else:
            # 1. Tasks I have handled in the past (Approved/Rejected)
            acted_request_ids = AuditLog.objects.filter(actor=user).values_list('request_id', flat=True)
            
            # 2. Requests currently waiting for my department
            dept_waiting_request_ids = ApprovalStep.objects.filter(
                status=ApprovalStep.StepStatus.WAITING,
                approver_type='TARGET_DEPT_ROLE',
                target_department_id__in=dept_ids
            ).values_list('request_id', flat=True)

            # 3. Combined relevance filter:
            relevant_requests = ApprovalRequest.objects.filter(
                Q(requester=user) |                          # I am the requester
                Q(id__in=acted_request_ids) |
                Q(id__in=dept_waiting_request_ids)
            ).distinct()

        status_counts = dict(
            relevant_requests.values_list('status')
            .annotate(count=Count('id', distinct=True))
            .values_list('status', 'count')
        )

        # Pending for current user (inbox count)
        if user.is_superuser:
            inbox_count = ApprovalRequest.objects.filter(status=ApprovalRequest.Status.IN_PROGRESS).count()
        else:
            waiting_ids = ApprovalStep.objects.filter(
                status=ApprovalStep.StepStatus.WAITING
            ).filter(
                Q(assigned_to=user) |
                Q(approver_type='REQUESTOR', request__requester=user) |
                Q(approver_type='TARGET_DEPT_ROLE', target_department_id__in=dept_ids)
            ).values_list('request_id', flat=True)

            discussion_ids = RequestFeedback.objects.filter(
                user=user
            ).values_list('request_id', flat=True)

            inbox_count = ApprovalRequest.objects.filter(
                id__in=set(waiting_ids) | set(discussion_ids),
                status=ApprovalRequest.Status.IN_PROGRESS
            ).distinct().count()

        # My submitted requests
        my_requests_count = ApprovalRequest.objects.filter(requester=user).count()

        # Recent activity (last 10 audit logs)
        if user.is_superuser:
            recent_logs = AuditLog.objects.all()
        else:
            # Modules where the user's role is an approver or user's department is targeted
            relevant_module_ids = WorkflowStepDefinition.objects.filter(
                Q(role_required__in=user.user_roles.values_list('role__id', flat=True)) |
                Q(approver_type='TARGET_DEPT_ROLE', target_department_id__in=dept_ids)
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
                'watching_count': RequestWatcher.objects.filter(user=user).count(),
                'recent_activity': activity_serializer.data,
                'module_counts': module_counts
            }
        })
    except Exception as e:
        logging.getLogger(__name__).error(
            "[Core.Views] Error in dashboard_summary for user %s: %s",
            user.username, str(e), exc_info=True
        )
        return Response(
            {'success': False, 'error': 'Failed to load dashboard summary.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

# ─────────────────────────────────────────────
# System Logs Endpoint
# ─────────────────────────────────────────────

import os
from django.conf import settings

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_logs(request):
    """
    GET /api/v1/admin/system-logs
    Reads the system log file.
    """
    if not request.user.is_superuser:
        return Response({'error': 'Only superusers can view logs.'}, status=status.HTTP_403_FORBIDDEN)

    log_file_path = os.path.join(settings.BASE_DIR, 'logs', 'log.log')
    try:
        with open(log_file_path, 'r') as f:
            lines = f.readlines()
            # Return last 2000 lines, reversed (newest first)
            log_content = "".join(lines[-2000:])
            return Response({'success': True, 'data': log_content})
    except FileNotFoundError:
        return Response({'success': False, 'error': 'Log file not found.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'success': False, 'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ─────────────────────────────────────────────
# Admin CRUD ViewSets
# ─────────────────────────────────────────────

class CompanyViewSet(viewsets.ModelViewSet):
    """CRUD for Companies."""
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code']


class OrganizationStructureViewSet(viewsets.ModelViewSet):
    """CRUD for Organization Structure Master."""
    queryset = OrganizationStructure.objects.all().select_related('company', 'user', 'department', 'reports_to')
    serializer_class = OrganizationStructureSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['company', 'department', 'is_dept_head']
    search_fields = ['position_title', 'user__username', 'company__name', 'department__name']


class DepartmentViewSet(viewsets.ModelViewSet):
    """CRUD for Departments with tiered approvers and members."""
    queryset = Department.objects.all().select_related('company', 'approver_1', 'approver_2', 'approver_3', 'dept_head').prefetch_related('org_structures__user')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['company']
    search_fields = ['name', 'code', 'company__name']

    @action(detail=True, methods=['post'], url_path='assign-members')
    def assign_members(self, request, pk=None):
        """
        Assign user(s) to this department.
        Accepts: {"user_ids": [1, 2, ...]} or {"user_id": 1, "position_title": "..."}
        """
        department = self.get_object()
        user_ids = request.data.get('user_ids')
        if not user_ids and request.data.get('user_id'):
            user_ids = [request.data.get('user_id')]

        if not user_ids:
            return Response({'error': 'user_ids is required'}, status=status.HTTP_400_BAD_REQUEST)

        position_title = request.data.get('position_title') or 'Staff / Requestor'
        created_count = 0
        for uid in user_ids:
            u = User.objects.filter(id=uid).first()
            if u:
                OrganizationStructure.objects.update_or_create(
                    user=u,
                    department=department,
                    defaults={
                        'company': department.company,
                        'position_title': position_title,
                        'level_order': 1,
                    }
                )
                created_count += 1

        return Response({
            'success': True,
            'message': f'{created_count} user(s) assigned to {department.name}',
            'members': DepartmentSerializer(department).data['members']
        })

    @action(detail=True, methods=['post'], url_path='remove-member')
    def remove_member(self, request, pk=None):
        """
        Remove a user mapping from this department.
        Accepts: {"user_id": 1} or {"org_id": 2}
        """
        department = self.get_object()
        user_id = request.data.get('user_id')
        org_id = request.data.get('org_id')

        if org_id:
            OrganizationStructure.objects.filter(id=org_id, department=department).delete()
        elif user_id:
            OrganizationStructure.objects.filter(user_id=user_id, department=department).delete()
        else:
            return Response({'error': 'user_id or org_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'success': True,
            'message': f'Member removed from {department.name}',
            'members': DepartmentSerializer(department).data['members']
        })



class DivisionViewSet(viewsets.ModelViewSet):
    """CRUD for Divisions."""
    queryset = Division.objects.all()
    serializer_class = DivisionSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code']


class ModuleViewSet(viewsets.ModelViewSet):
    """CRUD for Modules."""
    queryset = Module.objects.all()
    serializer_class = ModuleSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']

    @action(detail=True, methods=['get'])
    def variables(self, request, pk=None):
        """Get all variables for this module."""
        module = self.get_object()
        variables = module.variables.filter(is_active=True)
        serializer = ModuleVariableSerializer(variables, many=True)
        return Response(serializer.data)


class ModuleVariableViewSet(viewsets.ModelViewSet):
    """CRUD for ModuleVariables."""
    queryset = ModuleVariable.objects.all()
    serializer_class = ModuleVariableSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['module', 'is_active']


class RoleViewSet(viewsets.ModelViewSet):
    """CRUD for Roles."""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ['name', 'code']





class UserViewSet(viewsets.ModelViewSet):
    """CRUD for Users."""
    queryset = User.objects.prefetch_related(
        'user_roles__role',
        'org_positions__company',
        'org_positions__department__company'
    ).all()
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    search_fields = ['username', 'first_name', 'last_name', 'email']
    filterset_fields = ['user_roles__role', 'division', 'is_active', 'is_approver']

    def get_queryset(self):
        qs = super().get_queryset()
        same_company = str(self.request.query_params.get('same_company', '')).lower() in ('true', '1', 'yes')
        company_id_param = self.request.query_params.get('company_id')

        target_company_ids = []
        if company_id_param:
            try:
                target_company_ids = [int(company_id_param)]
            except (ValueError, TypeError):
                target_company_ids = []
        elif same_company and self.request.user and self.request.user.is_authenticated:
            target_company_ids = self.request.user.get_company_ids()

        if same_company or company_id_param:
            if not target_company_ids:
                return qs.none()
            qs = qs.filter(
                Q(org_positions__company_id__in=target_company_ids) |
                Q(org_positions__department__company_id__in=target_company_ids) |
                Q(dept_approver_1__company_id__in=target_company_ids) |
                Q(dept_approver_2__company_id__in=target_company_ids) |
                Q(dept_approver_3__company_id__in=target_company_ids) |
                Q(headed_departments__company_id__in=target_company_ids)
            ).distinct()

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return UserListSerializer
        return UserDetailSerializer


class WorkflowDefinitionViewSet(viewsets.ModelViewSet):
    """CRUD for WorkflowDefinitions (Admin)."""
    queryset = WorkflowDefinition.objects.select_related('module').prefetch_related('steps').all().order_by('id')
    permission_classes = [IsAuthenticated]
    filterset_fields = ['module', 'is_active']
    search_fields = ['name']

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return WorkflowDefinitionWriteSerializer
        return WorkflowDefinitionSerializer


class ApprovalRequestViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only ViewSet for listing/retrieving approval requests with search and filter support."""
    queryset = ApprovalRequest.objects.select_related(
        'module', 'workflow', 'requester'
    ).prefetch_related('steps', 'audit_logs').all()
    permission_classes = [IsAuthenticated]
    filterset_fields = {
        'reference_id': ['exact', 'icontains'],
        'module__code': ['exact'],
        'status': ['exact'],
        'updated_at': ['gt', 'gte'],
    }
    search_fields = [
        'title',
        'reference_id',
        'requester__first_name',
        'requester__last_name',
        'requester__username',
    ]

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return ApprovalRequestDetailSerializer
        return ApprovalRequestListSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.is_superuser:
            return qs
        return qs.filter(
            Q(requester=user) |
            Q(steps__assigned_to=user) |
            Q(watchers__user=user, watchers__deleted_at=None) |
            Q(audit_logs__actor=user)
        ).distinct()



class RequestFeedbackViewSet(viewsets.ModelViewSet):
    """ViewSet for RequestFeedback."""
    queryset = RequestFeedback.objects.select_related('user', 'request').all()
    serializer_class = RequestFeedbackSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['request', 'user', 'type', 'is_resolved']

    def get_queryset(self):
        return RequestFeedback.objects.filter(request_id=self.kwargs['request_pk'])

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

        # Add Log Activity
        AuditLog.objects.create(
            request=serializer.instance.request,
            actor=self.request.user,
            action=AuditLog.Action.FEEDBACK,
            details=f"Feedback added: {serializer.instance.content}"
        )


class BrandViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Brand."""
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer


class UserBrandViewSet(viewsets.ModelViewSet):
    """ViewSet for managing UserBrand mapping."""
    queryset = UserBrand.objects.all()
    serializer_class = UserBrandSerializer
    

class MasterWorkflowCriteriaViewSet(viewsets.ModelViewSet):
    """ViewSet for managing MasterWorkflowCondition mapping."""
    queryset = MasterWorkflowCriteria.objects.all()
    serializer_class = MasterWorkflowCriteriaSerializer


class CCEmailConfigViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing CC Email Configurations.
    """
    queryset = CCEmailConfig.objects.select_related('created_by').all()
    serializer_class = CCEmailConfigSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active', 'subject', 'ship_to']

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', None)
        if search:
            qs = qs.filter(Q(email__icontains=search) | Q(subject__icontains=search) | Q(ship_to__icontains=search))
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['patch', 'post'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        config = self.get_object()
        config.is_active = not config.is_active
        config.save()
        return Response({
            'success': True,
            'is_active': config.is_active,
            'message': f"Config for {config.email} is now {'active' if config.is_active else 'inactive'}."
        })

    @action(detail=False, methods=['post'], url_path='import-csv', parser_classes=[MultiPartParser, FormParser])
    def import_csv(self, request):
        """
        Import CC email configurations from a CSV file.
        CSV format must contain header columns: Ship_To, email
        The 'email' column can contain multiple emails separated by commas or semicolons.
        """
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'detail': 'Tidak ada file CSV yang diunggah.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not file_obj.name.lower().endswith('.csv'):
            return Response(
                {'detail': 'File harus berformat .csv'},
                status=status.HTTP_400_BAD_REQUEST
            )

        subject_val = request.data.get('subject', 'eorder information')
        if not subject_val:
            subject_val = 'eorder information'
        subject_val = str(subject_val).strip()

        try:
            content = file_obj.read()
            try:
                decoded_file = content.decode('utf-8-sig')
            except UnicodeDecodeError:
                decoded_file = content.decode('latin-1')

            import csv
            import io
            import re

            csv_file = io.StringIO(decoded_file)
            reader = csv.reader(csv_file)
            
            headers = next(reader, None)
            if not headers:
                return Response(
                    {'detail': 'File CSV kosong.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            header_map = {}
            for idx, h in enumerate(headers):
                cleaned_h = h.strip().lower().replace(' ', '_')
                header_map[cleaned_h] = idx

            ship_to_idx = None
            email_idx = None

            for key, idx in header_map.items():
                if key in ['ship_to', 'shipto', 'ship_to_code', 'ship_to_id', 'ship_to_no']:
                    ship_to_idx = idx
                elif key in ['email', 'emails', 'cc_email', 'cc_emails', 'email_address', 'email_addresses']:
                    email_idx = idx

            if ship_to_idx is None or email_idx is None:
                return Response(
                    {'detail': "Header CSV harus memiliki kolom 'Ship_To' dan 'email'."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            created_count = 0
            updated_count = 0
            skipped_count = 0
            errors = []
            
            email_regex = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

            with transaction.atomic():
                row_number = 1
                for row in reader:
                    row_number += 1
                    if not row or max(ship_to_idx, email_idx) >= len(row):
                        continue

                    ship_to_raw = row[ship_to_idx].strip()
                    email_raw = row[email_idx].strip()

                    if not email_raw:
                        continue

                    ship_to_val = ship_to_raw if ship_to_raw else None

                    # Split multiple emails by comma or semicolon
                    email_list = re.split(r'[,;]', email_raw)
                    for raw_item in email_list:
                        clean_email = raw_item.strip().lower()
                        if not clean_email:
                            continue

                        if not email_regex.match(clean_email):
                            errors.append(f"Baris {row_number}: Email '{clean_email}' format tidak valid.")
                            skipped_count += 1
                            continue

                        config, created = CCEmailConfig.objects.get_or_create(
                            email=clean_email,
                            subject=subject_val,
                            ship_to=ship_to_val,
                            defaults={
                                'is_active': True,
                                'created_by': request.user if request.user.is_authenticated else None
                            }
                        )
                        if created:
                            created_count += 1
                        else:
                            if not config.is_active:
                                config.is_active = True
                                config.save(update_fields=['is_active'])
                            updated_count += 1

            return Response({
                'success': True,
                'message': f'Berhasil mengimpor CSV. {created_count} konfig baru ditambahkan, {updated_count} konfig diperbarui.',
                'created_count': created_count,
                'updated_count': updated_count,
                'skipped_count': skipped_count,
                'errors': errors
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("Error importing CC email CSV")
            return Response(
                {'detail': f'Terjadi kesalahan saat memproses file CSV: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'], url_path='sync-gsheet')
    def sync_gsheet(self, request):
        """
        Synchronize CC email configurations directly from a Google Sheet tab (default: 'RD Shipment').
        Supports both public/link-shared sheets and private sheets shared with the Service Account.
        """

        default_url = 'https://docs.google.com/spreadsheets/d/1r7vi_SW8vh8jc3YI5h5RGkSBZQ_IVGCGpb2Oi9origM/edit?gid=0#gid=0'
        sheet_url = str(request.data.get('sheet_url') or default_url).strip()
        sheet_name = str(request.data.get('sheet_name') or 'Distributor').strip()
        subject_val = str(request.data.get('subject') or 'eorder information').strip()
        sync_mode = str(request.data.get('sync_mode') or 'mirror').strip().lower()

        if not subject_val:
            subject_val = 'eorder information'

        # Extract spreadsheet_id and gid from URL
        id_match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', sheet_url)
        spreadsheet_id = id_match.group(1) if id_match else sheet_url
        gid_match = re.search(r'[?&#]gid=([0-9]+)', sheet_url)
        gid = gid_match.group(1) if gid_match else '0'

        if not spreadsheet_id or '/' in spreadsheet_id:
            return Response(
                {'detail': 'URL Google Sheet tidak valid. Pastikan URL mengandung ID Spreadsheet.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sa_email = os.getenv('GDRIVE_EMAIL')
        sa_path = getattr(
            settings,
            'GOOGLE_SERVICE_ACCOUNT_FILE',
            os.path.join(settings.BASE_DIR, os.getenv('GDRIVE_CREDENTIALS'))
        )

        rows = None
        fetch_error_details = []

        def _parse_csv_bytes(content_bytes):
            try:
                text = content_bytes.decode('utf-8-sig')
            except UnicodeDecodeError:
                text = content_bytes.decode('latin-1')
            return list(csv.reader(io.StringIO(text)))

        def _is_valid_csv_response(resp):
            if resp.status_code != 200:
                return False
            if 'accounts.google.com' in resp.url or 'ServiceLogin' in resp.url:
                return False
            sample = resp.text[:300].lstrip().lower()
            if sample.startswith('<!doctype html') or sample.startswith('<html'):
                return False
            return True

        # 1. Try Service Account authentication first (if credentials file exists)
        if os.path.exists(sa_path):
            try:

                creds = service_account.Credentials.from_service_account_file(
                    sa_path,
                    scopes=[
                        'https://www.googleapis.com/auth/drive.readonly',
                        'https://www.googleapis.com/auth/spreadsheets.readonly',
                    ]
                )
                sa_email = getattr(creds, 'service_account_email', sa_email) or sa_email
                creds.refresh(GoogleAuthRequest())
                auth_headers = {'Authorization': f'Bearer {creds.token}'}

                # 1a. Try authenticated gviz CSV export by sheet_name
                if sheet_name:
                    gviz_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
                    resp = requests.get(gviz_url, headers=auth_headers, timeout=20)
                    if _is_valid_csv_response(resp):
                        rows = _parse_csv_bytes(resp.content)

                # 1b. Try authenticated export CSV by gid
                if rows is None and gid:
                    export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"
                    resp = requests.get(export_url, headers=auth_headers, timeout=20)
                    if _is_valid_csv_response(resp):
                        rows = _parse_csv_bytes(resp.content)

                # 1c. Try Google Drive API .xlsx export and parse exact sheet tab via openpyxl
                if rows is None:
                    drive_export_url = (
                        f"https://www.googleapis.com/drive/v3/files/{spreadsheet_id}/export"
                        f"?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                    resp = requests.get(drive_export_url, headers=auth_headers, timeout=30)
                    if resp.status_code == 200:
                        wb = openpyxl.load_workbook(io.BytesIO(resp.content), data_only=True)
                        target_ws = None
                        if sheet_name:
                            for name in wb.sheetnames:
                                if name.strip().lower() == sheet_name.strip().lower():
                                    target_ws = wb[name]
                                    break
                            if target_ws is None:
                                return Response(
                                    {
                                        'detail': (
                                            f"Tab '{sheet_name}' tidak ditemukan di Google Sheet. "
                                            f"Tab yang tersedia: {', '.join(wb.sheetnames)}"
                                        )
                                    },
                                    status=status.HTTP_400_BAD_REQUEST
                                )
                        else:
                            target_ws = wb.active

                        rows = [
                            [str(cell).strip() if cell is not None else '' for cell in row]
                            for row in target_ws.iter_rows(values_only=True)
                        ]
                    else:
                        fetch_error_details.append(f"Drive API HTTP {resp.status_code}")
            except Exception as sa_exc:
                logger.warning(f"Service account Google Sheet fetch warning: {sa_exc}")
                fetch_error_details.append(str(sa_exc))

        # 2. Fallback: Try Public / Anyone-with-link CSV export
        if rows is None:
            try:
                if sheet_name:
                    pub_gviz_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
                    resp = requests.get(pub_gviz_url, timeout=20, allow_redirects=True)
                    if _is_valid_csv_response(resp):
                        rows = _parse_csv_bytes(resp.content)

                if rows is None and gid:
                    pub_export_url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"
                    resp = requests.get(pub_export_url, timeout=20, allow_redirects=True)
                    if _is_valid_csv_response(resp):
                        rows = _parse_csv_bytes(resp.content)
            except Exception as pub_exc:
                logger.warning(f"Public Google Sheet fetch warning: {pub_exc}")
                fetch_error_details.append(str(pub_exc))

        if rows is None:
            return Response(
                {
                    'detail': (
                        f"Gagal mengakses Google Sheet (Tab '{sheet_name}'). "
                        f"Pastikan file Google Sheet telah di-share (Viewer) ke email Service Account: "
                        f"{sa_email} atau atur General Access menjadi 'Anyone with the link can view'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        if not rows:
            return Response(
                {'detail': f"Data pada tab '{sheet_name}' di Google Sheet kosong."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Locate the header row within the first 15 rows
        header_row_idx = None
        ship_to_idx = None
        email_indices = []

        ship_to_aliases = {
            'ship_to', 'shipto', 'ship_to_code', 'ship_to_id', 'ship_to_no',
            'shiptord', 'ship_to_rd', 'shipto_rd', 'kode_shipto', 'kode_ship_to', 'id_shipto',
            'rd_code', 'kode_rd', 'customer_code', 'cust_id', 'rd'
        }
        email_aliases = {
            'email', 'emails', 'cc_email', 'cc_emails', 'email_address',
            'email_addresses', 'email_rd', 'pic_email', 'alamat_email',
            'email_cc', 'email_distributor', 'email_pic',
            'eorder_notification', 'eorder_notifications', 'notification', 'notifications',
            'eorder_notif', 'eorder_notification_email'
        }

        for r_idx, row in enumerate(rows[:15]):
            cand_ship_to = None
            cand_emails = []
            for c_idx, cell in enumerate(row):
                cleaned = re.sub(r'[^a-z0-9]+', '_', str(cell).strip().lower()).strip('_')
                if not cleaned:
                    continue
                if cand_ship_to is None and (
                    cleaned in ship_to_aliases
                    or ('ship' in cleaned and 'to' in cleaned)
                    or 'shipto' in cleaned
                    or (c_idx == 0 and ('shipto' in cleaned or 'rd' in cleaned or 'ship' in cleaned))
                ):
                    cand_ship_to = c_idx
                elif (
                    cleaned in email_aliases
                    or 'email' in cleaned
                    or 'e_mail' in cleaned
                    or 'notification' in cleaned
                    or 'notif' in cleaned
                    or (c_idx == 4 and ('eorder' in cleaned or 'notif' in cleaned))
                ):
                    cand_emails.append(c_idx)

            if cand_ship_to is not None and cand_emails:
                header_row_idx = r_idx
                ship_to_idx = cand_ship_to
                email_indices = cand_emails
                break

        # Fallback specifically for tab Distributor or 5+ columns with Kolom A (Ship To) & Kolom E (eOrder Notification)
        if (header_row_idx is None or ship_to_idx is None or not email_indices) and rows:
            for r_idx, row in enumerate(rows[:15]):
                if len(row) > 4:
                    col_a = re.sub(r'[^a-z0-9]+', '_', str(row[0]).strip().lower()).strip('_')
                    col_e = re.sub(r'[^a-z0-9]+', '_', str(row[4]).strip().lower()).strip('_')
                    if ('shipto' in col_a or 'rd' in col_a or 'ship' in col_a) and (
                        'notif' in col_e or 'eorder' in col_e or 'mail' in col_e
                    ):
                        header_row_idx = r_idx
                        ship_to_idx = 0
                        email_indices = [4]
                        break

            # Fallback if first row is header and has at least 5 columns
            if header_row_idx is None and len(rows) > 1 and len(rows[0]) > 4:
                first_cell = str(rows[0][0]).strip()
                if not first_cell.isdigit():
                    header_row_idx = 0
                    ship_to_idx = 0
                    email_indices = [4]

        if header_row_idx is None or ship_to_idx is None or not email_indices:
            first_non_empty = next((r for r in rows[:5] if any(str(c).strip() for c in r)), [])
            return Response(
                {
                    'detail': (
                        f"Header kolom pada tab '{sheet_name}' tidak dikenali. "
                        f"Pastikan terdapat Kolom A (Ship To RD) dan Kolom E (eOrder Notification). "
                        f"(Header terdeteksi: {', '.join([str(c) for c in first_non_empty if str(c).strip()]) or 'Kosong'})"
                    )
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        created_count = 0
        updated_count = 0
        deleted_count = 0
        skipped_count = 0
        errors = []
        synced_keys = set()

        email_regex = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')

        try:
            with transaction.atomic():
                for offset, row in enumerate(rows[header_row_idx + 1:], start=header_row_idx + 2):
                    if not row or ship_to_idx >= len(row):
                        continue

                    ship_to_raw = str(row[ship_to_idx]).strip()
                    if re.match(r'^\d+\.0$', ship_to_raw):
                        ship_to_raw = ship_to_raw[:-2]
                    if ship_to_raw.lower() in ('none', 'null', 'nan', '-'):
                        ship_to_raw = ''

                    ship_to_val = ship_to_raw if ship_to_raw else None

                    raw_email_parts = []
                    for e_idx in email_indices:
                        if e_idx < len(row) and row[e_idx] is not None:
                            cell_val = str(row[e_idx]).strip()
                            if cell_val and cell_val.lower() not in ('none', 'null', 'nan', '-'):
                                raw_email_parts.append(cell_val)

                    if not raw_email_parts:
                        continue

                    combined_emails = ','.join(raw_email_parts)
                    email_list = re.split(r'[,;\n\r]+', combined_emails)

                    for raw_item in email_list:
                        clean_email = raw_item.strip().lower()
                        if not clean_email or clean_email in ('-', 'n/a', 'none', 'null'):
                            continue

                        if not email_regex.match(clean_email):
                            errors.append(f"Baris {offset}: Email '{clean_email}' (Ship To: {ship_to_val or 'ALL'}) format tidak valid.")
                            skipped_count += 1
                            continue

                        synced_keys.add((ship_to_val, clean_email))

                        config, created = CCEmailConfig.objects.get_or_create(
                            email=clean_email,
                            subject=subject_val,
                            ship_to=ship_to_val,
                            defaults={
                                'is_active': True,
                                'created_by': request.user if request.user.is_authenticated else None
                            }
                        )
                        if created:
                            created_count += 1
                        else:
                            if not config.is_active:
                                config.is_active = True
                                config.save(update_fields=['is_active'])
                            updated_count += 1

                if sync_mode == 'mirror' and synced_keys:
                    existing_configs = CCEmailConfig.objects.filter(subject=subject_val)
                    ids_to_delete = [
                        cfg.id for cfg in existing_configs
                        if (cfg.ship_to, cfg.email.strip().lower()) not in synced_keys
                    ]
                    if ids_to_delete:
                        deleted_count = len(ids_to_delete)
                        CCEmailConfig.objects.filter(id__in=ids_to_delete).delete()

            return Response({
                'success': True,
                'message': (
                    f"Sinkronisasi tab '{sheet_name}' selesai. "
                    f"{created_count} ditambahkan, {updated_count} diperbarui"
                    + (f", {deleted_count} dihapus (mirror sync)." if sync_mode == 'mirror' else ".")
                ),
                'sheet_name': sheet_name,
                'sync_mode': sync_mode,
                'created_count': created_count,
                'updated_count': updated_count,
                'deleted_count': deleted_count,
                'skipped_count': skipped_count,
                'errors': errors
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.exception("Error syncing CC email from Google Sheet")
            return Response(
                {'detail': f'Terjadi kesalahan saat sinkronisasi Google Sheet: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ─────────────────────────────────────────────
# PR Non-Trade ViewSet & Master Data ViewSets
# ─────────────────────────────────────────────

class PRNonTradeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for PR Non-Trade form submission & draft management.
    Integrates with Centralized Approval Workflow ID 10 upon submission.
    """
    serializer_class = PRNonTradeSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PRNonTradePagination

    def get_base_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return PRNonTrade.objects.all().select_related('approval_request').prefetch_related('items')
        return PRNonTrade.objects.filter(requestor=user).select_related('approval_request').prefetch_related('items')

    def get_queryset(self):
        qs = self.get_base_queryset()

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'ALL':
            if status_param == 'IN_PROGRESS':
                qs = qs.filter(
                    Q(status__in=['SUBMITTED', 'IN_PROGRESS', 'PENDING']) |
                    Q(approval_request__status__in=['SUBMITTED', 'IN_PROGRESS', 'PENDING'])
                ).exclude(
                    status__in=['DRAFT', 'CANCELLED', 'REVISE', 'REVISED', 'APPROVED', 'REJECTED']
                ).exclude(
                    approval_request__status__in=['REVISED', 'CANCELLED', 'APPROVED', 'REJECTED']
                )
            elif status_param in ('APPROVED', 'REJECTED'):
                qs = qs.filter(
                    Q(status=status_param) | Q(approval_request__status=status_param)
                ).exclude(
                    status__in=['DRAFT', 'CANCELLED']
                )
            else:
                qs = qs.filter(
                    Q(status=status_param) | Q(approval_request__status=status_param)
                )

        search_param = (self.request.query_params.get('search') or '').strip()
        if search_param:
            qs = qs.filter(
                Q(transaction_id__icontains=search_param) |
                Q(purpose__icontains=search_param) |
                Q(requestor_name__icontains=search_param) |
                Q(requester_department__icontains=search_param) |
                Q(status__icontains=search_param) |
                Q(approval_request__status__icontains=search_param)
            )

        return qs

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        if isinstance(response.data, dict):
            base_qs = self.get_base_queryset()
            response.data['total_all'] = base_qs.count()
            response.data['draft_count'] = base_qs.filter(status='DRAFT').count()
            response.data['submitted_count'] = base_qs.filter(
                Q(status__in=['SUBMITTED', 'IN_PROGRESS', 'PENDING']) |
                Q(approval_request__status__in=['SUBMITTED', 'IN_PROGRESS', 'PENDING'])
            ).exclude(
                status__in=['DRAFT', 'CANCELLED', 'REVISE', 'REVISED', 'APPROVED', 'REJECTED']
            ).exclude(
                approval_request__status__in=['REVISED', 'CANCELLED', 'APPROVED', 'REJECTED']
            ).count()
            response.data['approved_count'] = base_qs.filter(
                Q(status='APPROVED') | Q(approval_request__status='APPROVED')
            ).exclude(status__in=['DRAFT', 'CANCELLED']).count()
            response.data['rejected_count'] = base_qs.filter(
                Q(status='REJECTED') | Q(approval_request__status='REJECTED')
            ).exclude(status__in=['DRAFT', 'CANCELLED']).count()
            response.data['revised_count'] = base_qs.filter(
                Q(status='REVISED') | Q(approval_request__status='REVISED')
            ).exclude(status__in=['DRAFT', 'CANCELLED']).count()
        return response

    def perform_create(self, serializer):
        user = self.request.user
        dept = user.department if hasattr(user, 'department') else ''
        comp = user.company if hasattr(user, 'company') else ''

        serializer.save(
            requestor=user,
            requestor_name=user.get_full_name() or user.username,
            requester_department=serializer.validated_data.get('requester_department') or dept,
            requester_company=serializer.validated_data.get('requester_company') or comp,
        )

    @action(detail=False, methods=['post'], url_path='save-draft')
    def save_draft(self, request):
        """
        Save or update form as DRAFT.
        Generates transaction_id in format PR/{code_name}/NT/{year}/{6_digit_running_number}
        """
        pr_id = request.data.get('id')
        code_name = request.data.get('code_name') or 'HO'

        user = request.user
        dept = user.department if hasattr(user, 'department') else ''
        comp = user.company if hasattr(user, 'company') else ''
        if hasattr(user, 'company_code') and user.company_code:
            code_name = user.company_code

        if pr_id:
            try:
                pr = PRNonTrade.objects.get(id=pr_id, requestor=user)
            except PRNonTrade.DoesNotExist:
                return Response({'detail': 'PR Non-Trade record not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            pr = PRNonTrade(requestor=user)

        pr.requestor_name = user.get_full_name() or user.username
        pr.requester_department = request.data.get('requester_department') or dept
        pr.requester_company = request.data.get('requester_company') or comp
        pr.purpose = request.data.get('purpose', '')
        pr.goods_service_type = request.data.get('goods_service_type', 'not_lumpsum')
        pr.purchase_type = request.data.get('purchase_type', 'non_asset')
        pr.car_tbr_no = request.data.get('car_tbr_no', '')
        pr.asset_type = request.data.get('asset_type', 'non_wbs')
        pr.asset_no = request.data.get('asset_no', '')
        pr.wbs_no = request.data.get('wbs_no', '')
        pr.equipment_name = request.data.get('equipment_name', '')
        pr.submission_remark = request.data.get('submission_remark', '')
        pr.status = 'DRAFT'
        pr.save()
        pr.refresh_from_db()

        # Update items
        items_data = request.data.get('items', [])
        pr.items.all().delete()
        for idx, item in enumerate(items_data, 1):
            PRNonTradeItem.objects.create(
                pr_non_trade=pr,
                item_order=idx,
                goods_code=item.get('goods_code', ''),
                description=item.get('description', ''),
                unit=item.get('unit', 'PCS'),
                quantity=item.get('quantity', 1.0),
                remark=item.get('remark', '')
            )

        return Response({
            'success': True,
            'message': 'Draft saved successfully.',
            'data': PRNonTradeSerializer(pr).data
        }, status=status.HTTP_200_OK if pr_id else status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='submit')
    def submit_pr(self, request):
        """
        Submit PR Non-Trade form to Centralized Approval Workflow with workflow_id = 10.
        """
        pr_id = request.data.get('id')
        code_name = request.data.get('code_name') or 'HO'

        user = request.user
        dept = user.department if hasattr(user, 'department') else ''
        comp = user.company if hasattr(user, 'company') else ''
        if hasattr(user, 'company_code') and user.company_code:
            code_name = user.company_code

        if pr_id:
            try:
                pr = PRNonTrade.objects.get(id=pr_id, requestor=user)
            except PRNonTrade.DoesNotExist:
                return Response({'detail': 'PR Non-Trade record not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            pr = PRNonTrade(requestor=user)

        if not pr.transaction_id:
            pr.transaction_id = PRNonTrade.generate_transaction_id(code_name=code_name)

        pr.requestor_name = user.get_full_name() or user.username
        pr.requester_department = request.data.get('requester_department') or dept
        pr.requester_company = request.data.get('requester_company') or comp
        pr.purpose = request.data.get('purpose', '')
        pr.goods_service_type = request.data.get('goods_service_type', 'not_lumpsum')
        pr.purchase_type = request.data.get('purchase_type', 'non_asset')
        pr.car_tbr_no = request.data.get('car_tbr_no', '')
        pr.asset_type = request.data.get('asset_type', 'non_wbs')
        pr.asset_no = request.data.get('asset_no', '')
        pr.wbs_no = request.data.get('wbs_no', '')
        pr.equipment_name = request.data.get('equipment_name', '')
        pr.submission_remark = request.data.get('submission_remark', '')
        pr.status = 'SUBMITTED'
        pr.save()
        pr.refresh_from_db()

        # Update items
        items_data = request.data.get('items', [])
        pr.items.all().delete()
        items_list = []
        for idx, item in enumerate(items_data, 1):
            item_obj = PRNonTradeItem.objects.create(
                pr_non_trade=pr,
                item_order=idx,
                goods_code=item.get('goods_code', ''),
                description=item.get('description', ''),
                unit=item.get('unit', 'PCS'),
                quantity=item.get('quantity', 1.0),
                remark=item.get('remark', '')
            )
            items_list.append({
                'goods_code': item_obj.goods_code,
                'description': item_obj.description,
                'unit': item_obj.unit,
                'quantity': float(item_obj.quantity),
                'remark': item_obj.remark
            })

        # Ensure Module PR_NON_TRADE exists
        module, _ = Module.objects.get_or_create(
            code='PR_NON_TRADE',
            defaults={
                'name': 'PR Non-Trade',
                'description': 'Purchase Request Non-Trade Module',
                'is_active': True,
                'icon': 'file-text',
                'color': '#6366F1'
            }
        )

        if request.data.get('requester_company') == 'PT Nirwana Lestari':
            workflow_id = 11
        else :
            workflow_id = 10

        # Ensure WorkflowDefinition with ID 10 exists
        wf_def = WorkflowDefinition.objects.filter(id=workflow_id).first()
        if not wf_def:
            wf_def = WorkflowDefinition.objects.create(
                id=10,
                module=module,
                name='PR Non Trade Approval Workflow',
                description='Approval workflow for Non-Trade Purchase Requests',
                total_steps=2,
                is_active=True
            )
            if not wf_def.steps.exists():
                spv_role = Role.objects.filter(code='SPV').first() or Role.objects.first()
                if not spv_role:
                    spv_role = Role.objects.create(name='Supervisor', code='SPV')
                mgr_role = Role.objects.filter(code='MGR').first() or Role.objects.filter(code='SPV').first() or spv_role
                if not mgr_role:
                    mgr_role = Role.objects.create(name='Manager', code='MGR')
                WorkflowStepDefinition.objects.create(
                    workflow=wf_def,
                    step_order=1,
                    name='Department Head Review',
                    approver_type=WorkflowStepDefinition.ApproverType.REQ_DEPT_HEAD,
                    role_required=spv_role
                )
                WorkflowStepDefinition.objects.create(
                    workflow=wf_def,
                    step_order=2,
                    name='Finance / Manager Approval',
                    approver_type=WorkflowStepDefinition.ApproverType.ROLE,
                    role_required=mgr_role
                )

        # Submit request into Centralized Approval Workflow Engine
        payload = {
            'transaction_id': pr.transaction_id,
            'transaction_date': str(pr.transaction_date),
            'requestor_name': pr.requestor_name,
            'requester_department': pr.requester_department,
            'requester_company': pr.requester_company,
            'purpose': pr.purpose,
            'goods_service_type': pr.goods_service_type,
            'purchase_type': pr.purchase_type,
            'car_tbr_no': pr.car_tbr_no,
            'asset_type': pr.asset_type,
            'asset_no': pr.asset_no,
            'wbs_no': pr.wbs_no,
            'equipment_name': pr.equipment_name,
            'submission_remark': pr.submission_remark,
            'items': items_list
        }

        if pr.approval_request:
            approval_request = pr.approval_request
            approval_request.payload = payload
            approval_request.description = pr.purpose
            approval_request.title = f"PR Non Trade - {pr.transaction_id}"
            approval_request.status = ApprovalRequest.Status.IN_PROGRESS
            approval_request.current_step = 1
            approval_request.save(update_fields=['payload', 'description', 'title', 'status', 'current_step', 'updated_at'])

            # Reset steps back to step 1 waiting
            steps = approval_request.steps.all().order_by('step_order')
            for s in steps:
                if s.step_order == 1:
                    s.status = ApprovalStep.StepStatus.WAITING
                else:
                    s.status = ApprovalStep.StepStatus.PENDING
                s.comments = ''
                s.acted_at = None
                s.save(update_fields=['status', 'comments', 'acted_at'])

            # Add AuditLog
            AuditLog.objects.create(
                request=approval_request,
                actor=user,
                action=AuditLog.Action.SUBMITTED,
                details=f"PR Form has been revised and resubmitted by the requester ({user.get_full_name() or user.username}).",
                ip_address=_get_client_ip(request),
                payload_snapshot=approval_request.payload,
            )

            step1 = steps.filter(step_order=1).first()
            if step1:
                transaction.on_commit(lambda: email_service.send_step_notification(step1))
        else:
            approval_request = WorkflowEngine.submit_request(
                module_code='PR_NON_TRADE',
                workflow_id=workflow_id,
                requester=user,
                title=f"PR Non Trade - {pr.transaction_id}",
                payload=payload,
                description=pr.purpose,
                priority='MEDIUM',
                reference_id=pr.transaction_id,
                ip_address=_get_client_ip(request),
            )
            pr.approval_request = approval_request
            pr.save(update_fields=['approval_request'])

        return Response({
            'success': True,
            'message': f'PR Non-Trade submitted successfully with Reference ID: {pr.transaction_id}',
            'data': PRNonTradeSerializer(pr).data,
            'approval_request_id': approval_request.id
        }, status=status.HTTP_200_OK)


class MasterAssetViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MasterAsset.objects.all()
    serializer_class = MasterAssetSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['code', 'category', 'description']


class MasterWBSViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MasterWBS.objects.all()
    serializer_class = MasterWBSSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['code', 'description']


class MasterEquipmentViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MasterEquipment.objects.all()
    serializer_class = MasterEquipmentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['code', 'description', 'plant']


class MasterGoodsViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MasterGoods.objects.all()
    serializer_class = MasterGoodsSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['code', 'description', 'unit']


class MasterCarNumberViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = MasterCarNumber.objects.all()
    serializer_class = MasterCarNumberSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['code', 'description']
    filterset_fields = ['company_id']




