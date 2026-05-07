"""
Workflow Engine
===============
Central engine that processes all approval workflow operations.
Handles: submit_request, approve_step, reject_step, revise_request.
All approval logic is centralized here — modules should NOT implement their own approval logic.
"""
import json
import urllib.request
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from rest_framework.exceptions import ValidationError

from core.models import (
    Module, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, User, Division,
    Brand
)
from core.state_machine import can_transition


class WorkflowEngine:
    """
    Central approval workflow engine.
    Implements DRY principle: all approval logic resides here,
    not in individual modules.
    """

    @staticmethod
    def notify_external_system(approval_request):
        """
        Notify the external system about a status change.
        Supports WEBHOOK (HTTP POST) and DATABASE (Direct SQL Update).
        """
        module = approval_request.module
        
        if module.notification_strategy == 'WEBHOOK' and module.callback_url:
            WorkflowEngine._notify_webhook(approval_request)
        elif module.notification_strategy == 'DATABASE' and module.db_type:
            WorkflowEngine._notify_database(approval_request)

    @staticmethod
    def _notify_webhook(approval_request):
        """Send a notification to the source module's callback URL."""
        module = approval_request.module
        # Dynamic status mapping
        status_key = approval_request.status
        if status_key == ApprovalRequest.Status.IN_PROGRESS:
            status_key = f"IN_PROGRESS_{approval_request.current_step}"
        
        external_status = module.status_mapping.get(status_key, approval_request.status)

        payload = {
            'request_id': approval_request.id,
            'reference_id': approval_request.reference_id,
            'module_code': module.code,
            'status': approval_request.status,
            'external_status': external_status,
            'current_step': approval_request.current_step,
            'updated_at': approval_request.updated_at.isoformat(),
        }

        # Include details of the current step
        current_step = approval_request.steps.filter(
            step_order=approval_request.current_step
        ).first()

        if current_step:
            payload['step'] = {
                'order': current_step.step_order,
                'name': current_step.name,
                'status': current_step.status,
                'approver': current_step.assigned_to.username if current_step.assigned_to else None,
                'comments': current_step.comments,
            }

        try:
            req = urllib.request.Request(
                module.callback_url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                pass
        except Exception as e:
            print(f"Failed to notify external system (WEBHOOK): {e}")

    @staticmethod
    def _notify_database(approval_request):
        """Directly update the external system's database."""
        module = approval_request.module
        
        # This requires additional drivers (e.g., mysqlclient, psycopg2)
        # For now, we'll implement logic that can be extended
        try:
            if module.db_type == 'mysql':
                import MySQLdb
                conn = MySQLdb.connect(
                    host=module.db_host,
                    port=module.db_port or 3306,
                    user=module.db_user,
                    passwd=module.db_password,
                    db=module.db_name
                )
            elif module.db_type == 'postgresql':
                import psycopg2
                conn = psycopg2.connect(
                    host=module.db_host,
                    port=module.db_port or 5432,
                    user=module.db_user,
                    password=module.db_password,
                    dbname=module.db_name
                )
            else:
                print(f"Unsupported database type: {module.db_type}")
                return

            cursor = conn.cursor()
            
            # Map workflow steps to external status values using module.status_mapping
            status_key = approval_request.status
            if status_key == ApprovalRequest.Status.IN_PROGRESS:
                # Support granular mapping per step (e.g., "IN_PROGRESS_1")
                status_key = f"IN_PROGRESS_{approval_request.current_step}"
            
            # Use mapped value if exists, otherwise fallback to original status
            update_value = module.status_mapping.get(status_key, approval_request.status)

            query = f"UPDATE {module.db_table_name} SET {module.db_flag_column} = %s WHERE {module.db_reference_column} = %s"
            cursor.execute(query, (update_value, approval_request.reference_id))
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Failed to notify external system (DATABASE): {e}")

    @staticmethod
    @transaction.atomic
    def submit_request(module_code, workflow_id, requester, title, payload,
                       description='', priority='MEDIUM', reference_id='', 
                       division_id=None, ip_address=None, brand_code=None):
        """
        Submit a new approval request from any module.
        Creates the ApprovalRequest and generates all ApprovalStep instances
        based on the WorkflowDefinition.

        Args:
            module_code (str): Code identifying the source module.
            workflow_id (int): ID of the WorkflowDefinition to use.
            requester (User): The user submitting the request.
            title (str): Brief title for the request.
            payload (dict): JSON data from the source module.
            description (str): Optional longer description.
            priority (str): Priority level (LOW, MEDIUM, HIGH, URGENT).
            reference_id (str): External reference ID.
            division (str): Optional division/brand CODE (e.g., 'BRAND_A').
            ip_address (str): IP address of the requester.

        Returns:
            ApprovalRequest: The created approval request.

        Raises:
            ValidationError: If module/workflow is invalid or inactive.
        """
        # Validate module
        try:
            module = Module.objects.get(code=module_code, is_active=True)
        except Module.DoesNotExist:
            raise ValidationError(f"Module '{module_code}' not found or inactive.")

        # Validate workflow
        try:
            workflow = WorkflowDefinition.objects.get(
                id=workflow_id, module=module, is_active=True
            )
        except WorkflowDefinition.DoesNotExist:
            raise ValidationError(f"Workflow ID {workflow_id} not found or inactive for module '{module_code}'.")

        # Get step definitions
        step_defs = WorkflowStepDefinition.objects.filter(
            workflow=workflow
        ).order_by('step_order')

        if not step_defs.exists():
            raise ValidationError("Workflow has no step definitions configured.")

        # Create the approval request
        approval_request = ApprovalRequest.objects.create(
            reference_id=reference_id or f"{module_code}-{timezone.now().strftime('%Y%m%d%H%M%S')}",
            module=module,
            workflow=workflow,
            requester=requester,
            title=title,
            description=description,
            payload=payload,
            status=ApprovalRequest.Status.PENDING,
            current_step=1,
            priority=priority,
            division=division_id, # Store the code string
        )

        # Create approval steps from definitions
        for step_def in step_defs:
            assignee = None
            
            # 1. Check if step uses Brand-Specific Approval
            if step_def.is_brand_conditional:
                print(f"[DEBUG] Brand code: {brand_code}")
                if brand_code:
                    try:
                        brand = Brand.objects.get(code=brand_code)
                        print(f"[DEBUG] Brand found: {brand.owner}")
                        if brand.owner:
                            assignee = brand.owner
                    except Brand.DoesNotExist:
                        # Fallback to standard logic if brand not found
                        pass
            
            # 2. Fallback to standard logic if not brand-conditional or brand assignee not found
            if assignee is None:
                if step_def.approver_type == WorkflowStepDefinition.ApproverType.USER:
                    # Direct user assignment
                    assignee = step_def.user_required
                else:
                    # Role-based assignment: Auto-assign to first user with the required role and matching division
                    assignee_qs = User.objects.filter(
                        role=step_def.role_required, is_active=True, is_approver=True
                    )
                    
                    if division_id:
                        # User.division is a CharField, filter by the code string directly
                        assignee_qs = assignee_qs.filter(division=division_id)
                        
                    assignee = assignee_qs.first()

            step_status = (
                ApprovalStep.StepStatus.WAITING
                if step_def.step_order == 1
                else ApprovalStep.StepStatus.PENDING
            )

            ApprovalStep.objects.create(
                request=approval_request,
                step_order=step_def.step_order,
                name=step_def.name,
                approver_type=step_def.approver_type,
                assigned_to=assignee,
                role_required=step_def.role_required,
                user_required=step_def.user_required,
                status=step_status,
            )

        # Transition to IN_PROGRESS since first step is activated
        approval_request.status = ApprovalRequest.Status.IN_PROGRESS
        approval_request.save(update_fields=['status', 'updated_at'])

        # Create audit log
        AuditLog.objects.create(
            request=approval_request,
            actor=requester,
            action=AuditLog.Action.SUBMITTED,
            details=f"Request submitted: {title}",
            ip_address=ip_address,
            payload_snapshot=payload,
        )

        return approval_request

    @staticmethod
    @transaction.atomic
    def approve_step(request_id, approver, comments='', ip_address=None):
        """
        Approve the current step of an approval request.
        If this is the final step, the entire request is marked as APPROVED.
        Otherwise, advances to the next step.

        Args:
            request_id (int): ID of the ApprovalRequest.
            approver (User): User performing the approval.
            comments (str): Optional approval comments.
            ip_address (str): IP address of the approver.

        Returns:
            ApprovalRequest: The updated approval request.

        Raises:
            ValidationError: If request not found, wrong state, or user not authorized.
        """
        try:
            approval_request = ApprovalRequest.objects.select_for_update().get(id=request_id)
        except ApprovalRequest.DoesNotExist:
            raise ValidationError(f"Approval request {request_id} not found.")

        if approval_request.status != ApprovalRequest.Status.IN_PROGRESS:
            raise ValidationError(
                f"Cannot approve: request is in '{approval_request.status}' state."
            )

        # Get the current active step
        try:
            current_step = ApprovalStep.objects.get(
                request=approval_request,
                step_order=approval_request.current_step,
                status=ApprovalStep.StepStatus.WAITING,
            )
        except ApprovalStep.DoesNotExist:
            raise ValidationError("No active step found for this request.")

        # Verify the approver is authorized
        is_authorized = False
        
        # 1. Check if user is specifically required/assigned
        if current_step.user_required:
            if current_step.user_required == approver:
                is_authorized = True
        elif current_step.assigned_to:
            if current_step.assigned_to == approver:
                is_authorized = True
        
        # 2. Check if user has the required role (unless specifically assigned to someone else)
        if not is_authorized and current_step.role_required:
            if approver.role == current_step.role_required:
                # Role matches, now check division if necessary
                if not approval_request.division or approver.division == approval_request.division:
                    is_authorized = True
                else:
                    raise ValidationError(f"You are not authorized to approve requests for division '{approval_request.division}'.")

        if not is_authorized:
            raise ValidationError("You are not authorized to approve this step.")

        # Approve the current step
        current_step.status = ApprovalStep.StepStatus.APPROVED
        current_step.assigned_to = approver
        current_step.comments = comments
        current_step.acted_at = timezone.now()
        current_step.save()

        # Check if there's a next step
        next_step = ApprovalStep.objects.filter(
            request=approval_request,
            step_order=approval_request.current_step + 1
        ).first()

        if next_step:
            # Advance to next step
            next_step.status = ApprovalStep.StepStatus.WAITING
            next_step.save(update_fields=['status'])
            approval_request.current_step += 1
            approval_request.save(update_fields=['current_step', 'updated_at'])
        else:
            # Final step — mark as APPROVED
            if not can_transition(approval_request.status, ApprovalRequest.Status.APPROVED):
                raise ValidationError("Invalid state transition to APPROVED.")
            approval_request.status = ApprovalRequest.Status.APPROVED
            approval_request.save(update_fields=['status', 'updated_at'])

        # Create audit log
        AuditLog.objects.create(
            request=approval_request,
            step=current_step,
            actor=approver,
            action=AuditLog.Action.APPROVED,
            details=f"Step {current_step.step_order} ({current_step.name}) approved. {comments}".strip(),
            ip_address=ip_address,
            payload_snapshot=approval_request.payload,
        )

        # Notify external system after commit
        transaction.on_commit(lambda: WorkflowEngine.notify_external_system(approval_request))

        return approval_request

    @staticmethod
    @transaction.atomic
    def reject_step(request_id, approver, comments='', ip_address=None):
        """
        Reject the current step of an approval request.
        This sets the entire request to REJECTED status.

        Args:
            request_id (int): ID of the ApprovalRequest.
            approver (User): User performing the rejection.
            comments (str): Rejection reason (recommended).
            ip_address (str): IP address of the approver.

        Returns:
            ApprovalRequest: The updated approval request.

        Raises:
            ValidationError: If request not found, wrong state, or user not authorized.
        """
        try:
            approval_request = ApprovalRequest.objects.select_for_update().get(id=request_id)
        except ApprovalRequest.DoesNotExist:
            raise ValidationError(f"Approval request {request_id} not found.")

        if approval_request.status != ApprovalRequest.Status.IN_PROGRESS:
            raise ValidationError(
                f"Cannot reject: request is in '{approval_request.status}' state."
            )

        # Get the current active step
        try:
            current_step = ApprovalStep.objects.get(
                request=approval_request,
                step_order=approval_request.current_step,
                status=ApprovalStep.StepStatus.WAITING,
            )
        except ApprovalStep.DoesNotExist:
            raise ValidationError("No active step found for this request.")

        # Verify the approver is authorized
        is_authorized = False
        
        if current_step.user_required:
            if current_step.user_required == approver:
                is_authorized = True
        elif current_step.assigned_to:
            if current_step.assigned_to == approver:
                is_authorized = True
        
        if not is_authorized and current_step.role_required:
            if approver.role == current_step.role_required:
                if not approval_request.division or approver.division == approval_request.division:
                    is_authorized = True
                else:
                    raise ValidationError(f"You are not authorized to reject requests for division '{approval_request.division}'.")

        if not is_authorized:
            raise ValidationError("You are not authorized to reject this step.")

        # Reject the step
        current_step.status = ApprovalStep.StepStatus.REJECTED
        current_step.assigned_to = approver
        current_step.comments = comments
        current_step.acted_at = timezone.now()
        current_step.save()

        # Reject the entire request
        if not can_transition(approval_request.status, ApprovalRequest.Status.REJECTED):
            raise ValidationError("Invalid state transition to REJECTED.")
        approval_request.status = ApprovalRequest.Status.REJECTED
        approval_request.save(update_fields=['status', 'updated_at'])

        # Create audit log
        AuditLog.objects.create(
            request=approval_request,
            step=current_step,
            actor=approver,
            action=AuditLog.Action.REJECTED,
            details=f"Step {current_step.step_order} ({current_step.name}) rejected. Reason: {comments}".strip(),
            ip_address=ip_address,
            payload_snapshot=approval_request.payload,
        )

        # Notify external system after commit
        transaction.on_commit(lambda: WorkflowEngine.notify_external_system(approval_request))

        return approval_request

    @staticmethod
    @transaction.atomic
    def delegate_step(request_id, current_user, new_assignee, comments='', ip_address=None):
        """
        Delegate/reassign an approval step to another user.
        Can be done by the current assignee or an admin.

        Args:
            request_id (int): ID of the ApprovalRequest.
            current_user (User): User performing the delegation.
            new_assignee (User): User to whom the step is delegated.
            comments (str): Optional reason for delegation.
            ip_address (str): IP address.
        """
        try:
            approval_request = ApprovalRequest.objects.select_for_update().get(id=request_id)
        except ApprovalRequest.DoesNotExist:
            raise ValidationError(f"Approval request {request_id} not found.")

        # Get the current active step
        try:
            current_step = ApprovalStep.objects.get(
                request=approval_request,
                step_order=approval_request.current_step,
                status=ApprovalStep.StepStatus.WAITING,
            )
        except ApprovalStep.DoesNotExist:
            raise ValidationError("No active step found for this request.")

        # Authorization: Only current assignee or someone with the right role/id can delegate
        is_authorized = current_user.is_staff
        
        if not is_authorized:
            if current_step.user_required:
                is_authorized = (current_step.user_required == current_user)
            elif current_step.assigned_to:
                is_authorized = (current_step.assigned_to == current_user)
            
            if not is_authorized and current_step.role_required:
                is_authorized = (current_user.role == current_step.role_required)

        if not is_authorized:
            raise ValidationError("You are not authorized to delegate this step.")

        # Validate new assignee has the required role (if role-based)
        if current_step.role_required and not current_step.user_required:
            if new_assignee.role != current_step.role_required:
                raise ValidationError(f"User '{new_assignee.username}' does not have the required role.")

        old_assignee = current_step.assigned_to
        current_step.assigned_to = new_assignee
        current_step.save(update_fields=['assigned_to'])

        # Audit log
        AuditLog.objects.create(
            request=approval_request,
            step=current_step,
            actor=current_user,
            action=AuditLog.Action.REASSIGNED,
            details=f"Step {current_step.step_order} reassigned from {old_assignee} to {new_assignee}. Reason: {comments}".strip(),
            ip_address=ip_address,
            payload_snapshot=approval_request.payload,
        )

        return approval_request

    @staticmethod
    @transaction.atomic
    def revise_request(request_id, requester, updated_payload=None, ip_address=None):
        """
        Allow the requester to revise a rejected request and resubmit.
        Resets the workflow to step 1 with PENDING status.

        Args:
            request_id (int): ID of the ApprovalRequest.
            requester (User): User revising (must be the original requester).
            updated_payload (dict): Optional updated payload.
            ip_address (str): IP address.

        Returns:
            ApprovalRequest: The revised approval request.

        Raises:
            ValidationError: If request not REJECTED or user not the original requester.
        """
        try:
            approval_request = ApprovalRequest.objects.select_for_update().get(id=request_id)
        except ApprovalRequest.DoesNotExist:
            raise ValidationError(f"Approval request {request_id} not found.")

        if approval_request.status != ApprovalRequest.Status.REJECTED:
            raise ValidationError("Only rejected requests can be revised.")

        if approval_request.requester != requester:
            raise ValidationError("Only the original requester can revise this request.")

        # Update payload if provided
        if updated_payload:
            approval_request.payload = updated_payload

        # Transition: REJECTED → REVISED → PENDING
        approval_request.status = ApprovalRequest.Status.REVISED
        approval_request.save(update_fields=['status', 'payload', 'updated_at'])

        # Reset all steps
        approval_request.steps.all().update(
            status=ApprovalStep.StepStatus.PENDING,
            comments='',
            acted_at=None,
        )

        # Set first step to WAITING
        first_step = approval_request.steps.order_by('step_order').first()
        if first_step:
            first_step.status = ApprovalStep.StepStatus.WAITING
            first_step.save(update_fields=['status'])

        # Back to PENDING → IN_PROGRESS
        approval_request.status = ApprovalRequest.Status.PENDING
        approval_request.current_step = 1
        approval_request.save(update_fields=['status', 'current_step', 'updated_at'])

        approval_request.status = ApprovalRequest.Status.IN_PROGRESS
        approval_request.save(update_fields=['status', 'updated_at'])

        # Audit log
        AuditLog.objects.create(
            request=approval_request,
            actor=requester,
            action=AuditLog.Action.REVISED,
            details="Request revised and resubmitted.",
            ip_address=ip_address,
            payload_snapshot=approval_request.payload,
        )

        return approval_request
