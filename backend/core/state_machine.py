"""
State Machine
=============
Defines valid state transitions for the ApprovalRequest lifecycle.
Ensures no invalid status changes can occur.
"""
from core.models import ApprovalRequest


# Valid transitions: {current_status: [allowed_next_statuses]}
VALID_TRANSITIONS = {
    ApprovalRequest.Status.DRAFT: [
        ApprovalRequest.Status.PENDING,
    ],
    ApprovalRequest.Status.PENDING: [
        ApprovalRequest.Status.IN_PROGRESS,
    ],
    ApprovalRequest.Status.IN_PROGRESS: [
        ApprovalRequest.Status.APPROVED,
        ApprovalRequest.Status.REJECTED,
    ],
    ApprovalRequest.Status.REJECTED: [
        ApprovalRequest.Status.REVISED,
    ],
    ApprovalRequest.Status.REVISED: [
        ApprovalRequest.Status.PENDING,
    ],
    ApprovalRequest.Status.APPROVED: [],  # Terminal state
}


def can_transition(current_status, new_status):
    """
    Check if a transition from current_status to new_status is valid.

    Args:
        current_status: Current ApprovalRequest.Status value.
        new_status: Desired ApprovalRequest.Status value.

    Returns:
        bool: True if the transition is allowed.
    """
    allowed = VALID_TRANSITIONS.get(current_status, [])
    return new_status in allowed


def get_allowed_transitions(current_status):
    """
    Get list of allowed next statuses for a given current status.

    Args:
        current_status: Current ApprovalRequest.Status value.

    Returns:
        list: List of allowed status values.
    """
    return VALID_TRANSITIONS.get(current_status, [])
