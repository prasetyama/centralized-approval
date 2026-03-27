"""
Dummy Module Clients
====================
Example client classes showing how external modules would submit
approval requests to the centralized workflow engine.
These demonstrate the DRY principle: modules send payloads, engine handles logic.
"""
from core.engine import WorkflowEngine


class EOrderClient:
    """
    Dummy client for E-Order module.
    Demonstrates how the E-Order system would submit purchase order approvals.
    """

    @staticmethod
    def submit_purchase_order(requester, workflow_id, po_data):
        """
        Submit a Purchase Order for approval.

        Args:
            requester: User submitting the PO.
            workflow_id: ID of the workflow definition to use.
            po_data: dict with PO details (items, total, distributor, etc.)

        Returns:
            ApprovalRequest instance.
        """
        return WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=workflow_id,
            requester=requester,
            title=f"PO Approval: {po_data.get('po_number', 'N/A')}",
            payload={
                'type': 'purchase_order',
                'po_number': po_data.get('po_number'),
                'distributor': po_data.get('distributor'),
                'items': po_data.get('items', []),
                'total_amount': po_data.get('total_amount', 0),
                'currency': po_data.get('currency', 'IDR'),
                'delivery_date': po_data.get('delivery_date'),
                'notes': po_data.get('notes', ''),
            },
            priority=po_data.get('priority', 'MEDIUM'),
            reference_id=po_data.get('po_number', ''),
        )


class FinanceClient:
    """
    Dummy client for Finance module.
    Demonstrates budget/expense approval requests.
    """

    @staticmethod
    def submit_expense_claim(requester, workflow_id, expense_data):
        """Submit an expense claim for approval."""
        return WorkflowEngine.submit_request(
            module_code='FINANCE',
            workflow_id=workflow_id,
            requester=requester,
            title=f"Expense Claim: {expense_data.get('description', 'N/A')}",
            payload={
                'type': 'expense_claim',
                'description': expense_data.get('description'),
                'amount': expense_data.get('amount', 0),
                'currency': expense_data.get('currency', 'IDR'),
                'category': expense_data.get('category'),
                'receipts': expense_data.get('receipts', []),
                'date_incurred': expense_data.get('date_incurred'),
            },
            priority=expense_data.get('priority', 'MEDIUM'),
        )


class HRClient:
    """
    Dummy client for HR module.
    Demonstrates leave/onboarding approval requests.
    """

    @staticmethod
    def submit_leave_request(requester, workflow_id, leave_data):
        """Submit a leave request for approval."""
        return WorkflowEngine.submit_request(
            module_code='HR',
            workflow_id=workflow_id,
            requester=requester,
            title=f"Leave Request: {leave_data.get('leave_type', 'N/A')}",
            payload={
                'type': 'leave_request',
                'leave_type': leave_data.get('leave_type'),
                'start_date': leave_data.get('start_date'),
                'end_date': leave_data.get('end_date'),
                'days': leave_data.get('days', 1),
                'reason': leave_data.get('reason', ''),
                'delegate_to': leave_data.get('delegate_to'),
            },
            priority='MEDIUM',
        )
