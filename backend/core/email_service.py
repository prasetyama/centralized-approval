"""
Email Service
=============
Handles all email notifications for the approval workflow.
Uses Django's built-in email framework with SMTP backend.

All functions use a fire-and-forget pattern with try/except to ensure
email failures never interrupt the core approval workflow.
"""
import logging
import threading
from functools import wraps
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.db import close_old_connections

logger = logging.getLogger(__name__)


def run_in_thread(func):
    """Decorator to run a function in a background thread and clean up DB connections."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        def thread_target():
            try:
                func(*args, **kwargs)
            finally:
                close_old_connections()
        
        thread = threading.Thread(target=thread_target, daemon=True)
        thread.start()
    return wrapper


def _get_approver_email(step) -> str | None:
    """Get the email address of the approver for a given step."""
    if step.assigned_to and step.assigned_to.email:
        return step.assigned_to.email
    if step.user_required and step.user_required.email:
        return step.user_required.email
    return None


def _get_frontend_url() -> str:
    return getattr(settings, 'FRONTEND_URL')


@run_in_thread
def send_step_notification(step) -> None:
    """
    Send an email notification to the approver of the given step.
    Called when a step becomes WAITING (including step 1 after submit).

    Args:
        step (ApprovalStep): The approval step that needs action.
    """
    recipient_email = _get_approver_email(step)
    if not recipient_email:
        logger.warning(
            f"[EmailService] Step {step.step_order} of request '{step.request.title}' "
            f"has no assignee email. Skipping notification."
        )
        return

    approval_request = step.request
    requester = approval_request.requester

    context = {
        'approver_name': step.assigned_to.get_full_name() or step.assigned_to.username if step.assigned_to else 'Approver',
        'request_title': approval_request.title,
        'request_id': approval_request.id,
        'reference_id': approval_request.reference_id,
        'module_name': approval_request.module.name,
        'requester_name': requester.get_full_name() or requester.username,
        'requester_email': requester.email,
        'step_name': step.name,
        'step_order': step.step_order,
        'total_steps': approval_request.steps.count(),
        'priority': approval_request.priority,
        'description': approval_request.description,
        'frontend_url': _get_frontend_url(),
        'approval_url': f"{_get_frontend_url()}/workflow/{approval_request.id}",
    }

    subject = f"[Action Required] {approval_request.module.name}: {approval_request.title}"
    text_body = (
        f"Halo {context['approver_name']},\n\n"
        f"Anda memiliki permintaan approval yang perlu ditindaklanjuti.\n\n"
        f"Judul: {approval_request.title}\n"
        f"Modul: {approval_request.module.name}\n"
        f"Referensi: {approval_request.reference_id}\n"
        f"Diajukan oleh: {context['requester_name']}\n"
        f"Step: {step.step_order} - {step.name}\n\n"
        f"Silakan login untuk melihat detail dan mengambil tindakan:\n"
        f"{context['approval_url']}\n\n"
        f"Salam,\nApproval HUB"
    )

    try:
        html_body = render_to_string('email/step_notification.html', context)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient_email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(
            f"[EmailService] Step notification sent to {recipient_email} "
            f"for request #{approval_request.id} step {step.step_order}."
        )
    except Exception as e:
        logger.error(
            f"[EmailService] Failed to send step notification to {recipient_email}: {e}"
        )


@run_in_thread
def send_final_approved_notification(approval_request) -> None:
    """
    Send an email to the requester when all approval steps are completed.

    Args:
        approval_request (ApprovalRequest): The fully approved request.
    """
    requester = approval_request.requester
    if not requester.email:
        logger.warning(
            f"[EmailService] Requester {requester.username} has no email. "
            f"Skipping final approval notification for request #{approval_request.id}."
        )
        return

    context = {
        'requester_name': requester.get_full_name() or requester.username,
        'request_title': approval_request.title,
        'request_id': approval_request.id,
        'reference_id': approval_request.reference_id,
        'module_name': approval_request.module.name,
        'priority': approval_request.priority,
        'frontend_url': _get_frontend_url(),
        'detail_url': f"{_get_frontend_url()}/workflow/{approval_request.id}",
    }

    subject = f"[Approved] {approval_request.module.name}: {approval_request.title}"
    text_body = (
        f"Halo {context['requester_name']},\n\n"
        f"Permintaan Anda telah disetujui oleh semua approver.\n\n"
        f"Judul: {approval_request.title}\n"
        f"Modul: {approval_request.module.name}\n"
        f"Referensi: {approval_request.reference_id}\n\n"
        f"Lihat detail:\n{context['detail_url']}\n\n"
        f"Salam,\nApproval HUB"
    )

    try:
        html_body = render_to_string('email/final_approved.html', context)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[requester.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(
            f"[EmailService] Final approval notification sent to {requester.email} "
            f"for request #{approval_request.id}."
        )
    except Exception as e:
        logger.error(
            f"[EmailService] Failed to send final approval notification to {requester.email}: {e}"
        )


@run_in_thread
def send_rejected_notification(approval_request, step) -> None:
    """
    Send an email to the requester when their request is rejected.

    Args:
        approval_request (ApprovalRequest): The rejected request.
        step (ApprovalStep): The step at which the rejection occurred.
    """
    requester = approval_request.requester
    if not requester.email:
        logger.warning(
            f"[EmailService] Requester {requester.username} has no email. "
            f"Skipping rejection notification for request #{approval_request.id}."
        )
        return

    rejector = step.assigned_to
    context = {
        'requester_name': requester.get_full_name() or requester.username,
        'request_title': approval_request.title,
        'request_id': approval_request.id,
        'reference_id': approval_request.reference_id,
        'module_name': approval_request.module.name,
        'step_name': step.name,
        'step_order': step.step_order,
        'rejector_name': rejector.get_full_name() or rejector.username if rejector else 'Approver',
        'rejection_reason': step.comments or '(Tidak ada keterangan)',
        'priority': approval_request.priority,
        'frontend_url': _get_frontend_url(),
        'detail_url': f"{_get_frontend_url()}/workflow/{approval_request.id}",
    }

    subject = f"[Ditolak] {approval_request.module.name}: {approval_request.title}"
    text_body = (
        f"Halo {context['requester_name']},\n\n"
        f"Permintaan Anda telah ditolak.\n\n"
        f"Judul: {approval_request.title}\n"
        f"Modul: {approval_request.module.name}\n"
        f"Referensi: {approval_request.reference_id}\n"
        f"Ditolak oleh: {context['rejector_name']} (Step {step.step_order}: {step.name})\n"
        f"Alasan: {context['rejection_reason']}\n\n"
        f"Anda dapat melakukan revisi melalui:\n{context['detail_url']}\n\n"
        f"Salam,\nApproval HUB"
    )

    try:
        html_body = render_to_string('email/rejected.html', context)
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[requester.email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(
            f"[EmailService] Rejection notification sent to {requester.email} "
            f"for request #{approval_request.id}."
        )
    except Exception as e:
        logger.error(
            f"[EmailService] Failed to send rejection notification to {requester.email}: {e}"
        )
