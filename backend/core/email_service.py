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


def _get_cc_emails_for_subject(subject_name: str = 'eorder information') -> list[str]:
    """Fetch list of active CC emails for the specified subject."""
    try:
        from core.models import CCEmailConfig
        configs = CCEmailConfig.objects.filter(is_active=True, subject__iexact=subject_name)
        return list(configs.values_list('email', flat=True))
    except Exception as e:
        logger.error(f"[EmailService] Failed to fetch CC emails for subject '{subject_name}': {e}")
        return []


@run_in_thread
def send_eorder_info_cc_notification(approval_request) -> None:
    """
    Send CC notification for eOrder Information to configured CC emails.
    Format specified:
    Hi, This Data eOrder Information :

    Submitted Order With Filename Order ID <ID>

    Distributor Name: <Distributor>
    City: <City>
    PO Date: <PO Date>
    Delivery Date: <Delivery Date>
    Type Order: <Type Order>
    Items Success: <Count> items(s)
    Items Rejected: <Count> items(s)
    Inserted On: <Date>
    Inserted By: <User>

    See Order Click This Link: <URL>
    """
    cc_emails = _get_cc_emails_for_subject('eorder information')
    if not cc_emails:
        logger.info(f"[EmailService] No active CC email configs found for subject 'eorder information'. Skipping.")
        return

    payload = approval_request.payload or {}
    requester = approval_request.requester

    # Extract fields from payload with fallbacks
    filename_order_id = approval_request.reference_id or payload.get('reference_id') or payload.get('filename') or ''
    distributor_name = payload.get('distributor') or payload.get('distributor_name') or requester.get_full_name() or requester.username
    city = payload.get('city') or payload.get('cust_city') or '-'
    po_date = payload.get('po_date') or payload.get('po_number') or '-'
    delivery_date = payload.get('delivery_date') or '-'
    type_order = payload.get('order_type') or payload.get('type_order') or 'FIX'

    items_success_count = payload.get('items_success')
    if items_success_count is None:
        items_success_count = payload.get('total_sku', 0)
    items_success = f"{items_success_count} items(s)"

    items_rejected_count = payload.get('items_rejected', 0)
    items_rejected = f"{items_rejected_count} items(s)"

    inserted_on = payload.get('inserted_on') or payload.get('submitted_at')
    if not inserted_on:
        inserted_on = approval_request.created_at.strftime('%m/%d/%Y %I:%M:%S %p') if approval_request.created_at else '-'

    inserted_by = payload.get('inserted_by') or distributor_name

    approval_url = f"{_get_frontend_url()}/workflow/{approval_request.id}"

    context = {
        'filename_order_id': filename_order_id,
        'distributor_name': distributor_name,
        'city': city,
        'po_date': po_date,
        'delivery_date': delivery_date,
        'type_order': type_order,
        'items_success': items_success,
        'items_rejected': items_rejected,
        'inserted_on': inserted_on,
        'inserted_by': inserted_by,
        'approval_url': approval_url,
    }

    subject = f"eOrder Information - {filename_order_id}"

    text_body = (
        f"Hi, This Data eOrder Information :\n\n\n"
        f"Submitted Order With Filename Order ID {filename_order_id}\n\n"
        f"Distributor Name\t:\t{distributor_name}\n"
        f"City\t:\t{city}\n"
        f"PO Date\t:\t{po_date}\n"
        f"Delivery Date\t:\t{delivery_date}\n"
        f"Type Order\t:\t{type_order}\n"
        f"Items Success\t:\t{items_success}\n"
        f"Items Rejected\t:\t{items_rejected}\n"
        f"Inserted On\t:\t{inserted_on}\n"
        f"Inserted By\t:\t{inserted_by}\n\n"
        f"See Order Click This Link: {approval_url}"
    )

    try:
        html_body = render_to_string('email/eorder_information.html', context)
    except Exception as e:
        html_body = (
            f"<div style='font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;'>"
            f"<p>Hi, This Data eOrder Information :</p><br/>"
            f"<p><strong>Submitted Order With Filename Order ID {filename_order_id}</strong></p>"
            f"<table style='border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 14px;'>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Distributor Name</td><td>:</td><td style='padding-left: 8px;'>{distributor_name}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>City</td><td>:</td><td style='padding-left: 8px;'>{city}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>PO Date</td><td>:</td><td style='padding-left: 8px;'>{po_date}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Delivery Date</td><td>:</td><td style='padding-left: 8px;'>{delivery_date}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Type Order</td><td>:</td><td style='padding-left: 8px;'>{type_order}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Items Success</td><td>:</td><td style='padding-left: 8px;'>{items_success}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Items Rejected</td><td>:</td><td style='padding-left: 8px;'>{items_rejected}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Inserted On</td><td>:</td><td style='padding-left: 8px;'>{inserted_on}</td></tr>"
            f"<tr><td style='padding: 4px 12px 4px 0; font-weight: bold;'>Inserted By</td><td>:</td><td style='padding-left: 8px;'>{inserted_by}</td></tr>"
            f"</table>"
            f"<p><a href='{approval_url}' style='display: inline-block; padding: 10px 18px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;'>See Order Click This Link</a></p>"
            f"</div>"
        )

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=cc_emails,
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)
        logger.info(
            f"[EmailService] eOrder Information CC email sent to {cc_emails} "
            f"for request #{approval_request.id}."
        )
    except Exception as e:
        logger.error(
            f"[EmailService] Failed to send eOrder Information CC email to {cc_emails}: {e}"
        )

