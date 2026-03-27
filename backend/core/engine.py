"""
Workflow Engine
===============
Central engine that processes all approval workflow operations.
Handles: submit_request, approve_step, reject_step, revise_request.
All approval logic is centralized here — modules should NOT implement their own approval logic.
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import (
    Module, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, User
)
from core.state_machine import can_transition


class WorkflowEngine:
    """
    Central approval workflow engine.
    Implements DRY principle: all approval logic resides here,
    not in individual modules.
    """

    @staticmethod
    @transaction.atomic
    def submit_request(module_code, workflow_id, requester, title, payload,
                       description='', priority='MEDIUM', reference_id='', ip_address=None):
        """
        Submit a new approval request from any module.
        Creates the ApprovalRequest and generates all ApprovalStep instances
        based on the WorkflowDefinition.

        Args:
            module_code (str): Code of the source module (e.g., 'EORDER').
            workflow_id (int): ID of the WorkflowDefinition to use.
            requester (User): User submitting the request.
            title (str): Brief title for the request.
            payload (dict): JSON payload from the source module.
            description (str): Optional description.
            priority (str): Priority level (LOW/MEDIUM/HIGH/URGENT).
            reference_id (str): External reference ID.
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
        )

        # Create approval steps from definitions
        for step_def in step_defs:
            # Auto-assign to first user with the required role
            assignee = User.objects.filter(
                role=step_def.role_required, is_active=True, is_approver=True
            ).first()

            step_status = (
                ApprovalStep.StepStatus.WAITING
                if step_def.step_order == 1
                else ApprovalStep.StepStatus.PENDING
            )

            ApprovalStep.objects.create(
                request=approval_request,
                step_order=step_def.step_order,
                name=step_def.name,
                assigned_to=assignee,
                role_required=step_def.role_required,
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

        # Verify the approver has the right role or is directly assigned
        if current_step.assigned_to and current_step.assigned_to != approver:
            if approver.role != current_step.role_required:
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

        # Verify authorization
        if current_step.assigned_to and current_step.assigned_to != approver:
            if approver.role != current_step.role_required:
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
