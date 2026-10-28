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
from django.db.models import Q
from django.utils import timezone
from django.conf import settings
from rest_framework.exceptions import ValidationError
import logging

from core.models import (
    Module, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, User, Division, Department,
    Company, OrganizationStructure, Brand, RequestWatcher
)
from core.state_machine import can_transition
from core import email_service


class WorkflowEngine:
    """
    not in individual modules.
    """

    @staticmethod
    def _evaluate_conditions(payload, conditions):
        """
        Evaluate a list of conditions against a JSON payload.
        Conditions format: [{'field': 'key', 'operator': '>', 'value': 100}]
        """
        if not conditions:
            return True

        for condition in conditions:
            field = condition.get('field')
            operator = condition.get('operator')
            target_value = condition.get('value')
            
            # Get value from payload (supports nested keys if needed, but let's keep it simple for now)
            actual_value = payload.get(field)

            # Type conversion/inference
            try:
                if isinstance(target_value, bool):
                    actual_value = bool(actual_value)
                elif isinstance(target_value, (int, float)):
                    actual_value = float(actual_value)
                    target_value = float(target_value)
                else:
                    actual_value = str(actual_value) if actual_value is not None else ""
                    target_value = str(target_value)
            except (ValueError, TypeError):
                # If conversion fails, the condition is not met
                return False

            # Comparison logic
            if operator == '==':
                if not (actual_value == target_value): return False
            elif operator == '!=':
                if not (actual_value != target_value): return False
            elif operator == '>':
                if not (actual_value > target_value): return False
            elif operator == '<':
                if not (actual_value < target_value): return False
            elif operator == '>=':
                if not (actual_value >= target_value): return False
            elif operator == '<=':
                if not (actual_value <= target_value): return False
            else:
                return False # Unknown operator
        
        return True

    @staticmethod
    def _activate_next_step(approval_request):
        """
        Find and activate the next non-skipped step.
        If no more steps, mark the request as APPROVED.
        Sends email notification to the next approver, or final approved email to requester.
        """
        next_step = ApprovalStep.objects.filter(
            request=approval_request,
            step_order__gt=approval_request.current_step
        ).order_by('step_order').first()

        while next_step and next_step.status == ApprovalStep.StepStatus.SKIPPED:
            approval_request.current_step = next_step.step_order
            next_step = ApprovalStep.objects.filter(
                request=approval_request,
                step_order__gt=approval_request.current_step
            ).order_by('step_order').first()

        if next_step:
            next_step.status = ApprovalStep.StepStatus.WAITING
            next_step.save(update_fields=['status'])
            approval_request.current_step = next_step.step_order
            approval_request.save(update_fields=['current_step', 'updated_at'])
            # Notify next approver via email after commit
            _captured_step = next_step
            transaction.on_commit(lambda: email_service.send_step_notification(_captured_step))
            return False  # Not finished
        else:
            # Final step reached
            if not can_transition(approval_request.status, ApprovalRequest.Status.APPROVED):
                raise ValidationError("Invalid state transition to APPROVED.")
            approval_request.status = ApprovalRequest.Status.APPROVED
            approval_request.save(update_fields=['status', 'updated_at'])
            # Notify requester that request is fully approved
            _captured_req = approval_request
            transaction.on_commit(lambda: email_service.send_final_approved_notification(_captured_req))
            return True  # Finished

    @staticmethod
    def notify_external_system(approval_request, dlvdate=None, acted_step=None, approver=None):
        """
        Notify the external system about a status change.
        Supports WEBHOOK (HTTP POST) and DATABASE (Direct SQL Update).
        """
        module = approval_request.module
        
        if module.notification_strategy == 'WEBHOOK' and module.callback_url:
            WorkflowEngine._notify_webhook(approval_request, dlvdate=dlvdate, acted_step=acted_step, approver=approver)
        elif module.notification_strategy == 'DATABASE' and module.db_type:
            WorkflowEngine._notify_database(approval_request, dlvdate=dlvdate, acted_step=acted_step)

    @staticmethod
    def _notify_webhook(approval_request, dlvdate=None, acted_step=None, approver=None):
        """Send a notification to the source module's callback URL."""
        module = approval_request.module
        # Dynamic status mapping
        status_key = approval_request.status
        if status_key == ApprovalRequest.Status.IN_PROGRESS:
            status_key = f"IN_PROGRESS_{approval_request.current_step}"
        
        external_status = module.status_mapping.get(status_key, approval_request.status)

        approved_by_val = None
        if isinstance(approver, str):
            approved_by_val = approver
        elif hasattr(approver, 'username'):
            approved_by_val = approver.username
        elif isinstance(approver, dict):
            approved_by_val = approver.get('username') or approver.get('name') or str(approver)
        elif approver is not None:
            approved_by_val = str(approver)

        payload = {
            'request_id': approval_request.id,
            'reference_id': approval_request.reference_id,
            'module_code': module.code,
            'status': approval_request.status,
            'external_status': external_status,
            'current_step': approval_request.current_step,
            'updated_at': approval_request.updated_at.isoformat(),
            'approved_by': approved_by_val,
        }

        if dlvdate:
            payload['dlvdate'] = dlvdate

        # Include details of the current or acted step
        step_obj = acted_step or approval_request.steps.filter(
            step_order=approval_request.current_step
        ).first()

        if step_obj:
            step_dict = {
                'order': step_obj.step_order,
                'name': step_obj.name,
                'status': step_obj.status,
                'approver': step_obj.assigned_to.username if step_obj.assigned_to else None,
                'comments': step_obj.comments,
            }
            if dlvdate:
                step_dict['dlvdate'] = dlvdate
            payload['step'] = step_dict

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
            logging.getLogger(__name__).error(
                "[Core.Engine] Failed to notify external system (WEBHOOK) for request %s: %s", 
                approval_request.id, str(e), exc_info=True
            )
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
            logging.getLogger(__name__).error(
                "[Core.Engine] Failed to notify external system (DATABASE) for request %s: %s", 
                approval_request.id, str(e), exc_info=True
            )
            print(f"Failed to notify external system (DATABASE): {e}")


    @staticmethod
    def get_org_approval_chain(requester, company_code=None):
        """
        Resolve the approval hierarchy chain for REQ_DEPT_HEAD based on the requester's Department
        approvers (Approver 1 -> Approver 2 -> Approver 3).
        Falls back to reports_to traversal if Department approvers are not configured.
        Returns a list of dicts: [{'user': User, 'title': str, 'level_order': int, 'is_dept_head': bool}]
        """
        if not requester:
            return []

        # 1. Look up the requester's department
        req_org = OrganizationStructure.objects.filter(user=requester).select_related('department', 'company').first()
        dept = None
        if req_org and req_org.department:
            dept = req_org.department
        elif hasattr(requester, 'department') and requester.department:
            dept = Department.objects.filter(
                Q(name=requester.department) | Q(code=requester.department)
            ).first()

        # 2. Check simplified department approvers (approver_1, approver_2, approver_3)
        if dept and (dept.approver_1 or dept.approver_2 or dept.approver_3):
            chain = []
            candidates = [
                (1, dept.approver_1, 'Approver 1'),
                (2, dept.approver_2, 'Approver 2'),
                (3, dept.approver_3, 'Approver 3'),
            ]
            active_levels = [lvl for lvl, usr, _ in candidates if usr]
            highest_level = max(active_levels) if active_levels else 2

            for lvl, app_user, label in candidates:
                if not app_user:
                    continue
                # If requester is one of the approvers, skip this step so they don't approve their own request
                if app_user.id == requester.id:
                    continue
                if any(link['user'].id == app_user.id for link in chain):
                    continue

                chain.append({
                    'user': app_user,
                    'title': f"{dept.name} - {label}",
                    'level_order': lvl,
                    'is_dept_head': (lvl == highest_level or (lvl == 2 and not dept.approver_3)),
                })

            if chain:
                return chain

        # 3. Fallback: Traverse legacy reports_to hierarchy in OrganizationStructure
        chain = []
        visited = set()
        current_user = requester

        # Determine company filter
        company = None
        if company_code:
            company = Company.objects.filter(code=company_code).first()
        if not company and req_org and req_org.company:
            company = req_org.company

        while current_user and current_user.id not in visited:
            visited.add(current_user.id)

            qs = OrganizationStructure.objects.filter(user=current_user).select_related('reports_to', 'department', 'company')
            if company:
                qs = qs.filter(company=company)

            node = qs.first()
            if not node or not node.reports_to:
                break

            manager_user = node.reports_to
            if manager_user.id in visited:
                break

            mgr_qs = OrganizationStructure.objects.filter(user=manager_user)
            if company:
                mgr_qs = mgr_qs.filter(company=company)
            mgr_node = mgr_qs.first()

            chain.append({
                'user': manager_user,
                'title': mgr_node.position_title if mgr_node else (manager_user.get_full_name() or manager_user.username),
                'level_order': mgr_node.level_order if mgr_node else 1,
                'is_dept_head': mgr_node.is_dept_head if mgr_node else False,
            })

            current_user = manager_user
            if mgr_node and mgr_node.is_dept_head:
                break

        return chain

    # @staticmethod
    # def get_dept_approval_chain(department, company_code=None, requester=None):
    #     """
    #     Traverse the master OrganizationStructure table or Department approvers to resolve the approval hierarchy chain
    #     for a specific department (e.g. Purchasing).
    #     Returns a list of dicts: [{'user': User, 'title': str, 'level_order': int, 'is_dept_head': bool}]
    #     """
    #     if not department:
    #         return []

    #     # Check simplified department approvers
    #     if department and (department.approver_1 or department.approver_2 or department.approver_3):
    #         chain = []
    #         candidates = [
    #             (1, department.approver_1, 'Approver 1'),
    #             (2, department.approver_2, 'Approver 2'),
    #             (3, department.approver_3, 'Approver 3'),
    #         ]
    #         active_levels = [lvl for lvl, usr, _ in candidates if usr]
    #         highest_level = max(active_levels) if active_levels else 2

    #         for lvl, app_user, label in candidates:
    #             if not app_user:
    #                 continue
    #             if requester and app_user.id == requester.id:
    #                 continue
    #             if any(link['user'].id == app_user.id for link in chain):
    #                 continue

    #             chain.append({
    #                 'user': app_user,
    #                 'title': f"{department.name} - ",
    #                 'level_order': lvl,
    #                 'is_dept_head': (lvl == highest_level or (lvl == 2 and not department.approver_3)),
    #             })

    #         if chain:
    #             return chain

    #     company = None
    #     if company_code:
    #         company = Company.objects.filter(code=company_code).first()
    #     if not company and requester:
    #         req_org = OrganizationStructure.objects.filter(user=requester).select_related('company').first()
    #         if req_org and req_org.company:
    #             company = req_org.company

    #     # Find starting node in target department
    #     qs = OrganizationStructure.objects.filter(department=department).select_related('user', 'reports_to', 'company')
    #     if company:
    #         qs = qs.filter(company=company)

    #     start_node = qs.order_by('level_order').first()
    #     if not start_node or not start_node.user:
    #         return []

    #     chain = []
    #     visited = set()
    #     current_user = start_node.user

    #     # If requester is the starting node in department, skip requester to start from their manager
    #     if requester and current_user.id == requester.id:
    #         if start_node.reports_to:
    #             current_user = start_node.reports_to
    #         else:
    #             return []


    #     while current_user and current_user.id not in visited:
    #         visited.add(current_user.id)

    #         node_qs = OrganizationStructure.objects.filter(user=current_user).select_related('reports_to', 'department', 'company')
    #         if company:
    #             node_qs = node_qs.filter(company=company)
    #         node = node_qs.first()

    #         chain.append({
    #             'user': current_user,
    #             'title': node.position_title if node else (current_user.get_full_name() or current_user.username),
    #             'level_order': node.level_order if node else 1,
    #             'is_dept_head': node.is_dept_head if node else False,
    #         })

    #         if node and node.is_dept_head:
    #             break

    #         if not node or not node.reports_to:
    #             break

    #         current_user = node.reports_to

    #     return chain

    @staticmethod
    @transaction.atomic
    def submit_request(module_code, workflow_id, requester, title, payload,
                       description='', priority='MEDIUM', reference_id='', 
                       division_id=None, ip_address=None, watcher_ids=None):
        """
        Submit a new approval request from any module.
        Creates the ApprovalRequest and generates all ApprovalStep instances
        based on the WorkflowDefinition.
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
            division=division_id,
        )

        current_step_order = 1

        # Create approval steps from definitions
        for step_def in step_defs:
            # Check for REQ_DEPT_HEAD or PURCH_DEPT_HEAD to expand dynamic organization hierarchy chain
            if step_def.approver_type in (WorkflowStepDefinition.ApproverType.REQ_DEPT_HEAD, WorkflowStepDefinition.ApproverType.PURCH_DEPT_HEAD):
                company_code = payload.get('company_code')
                if step_def.approver_type == WorkflowStepDefinition.ApproverType.REQ_DEPT_HEAD:
                    org_chain = WorkflowEngine.get_org_approval_chain(requester, company_code=company_code)
                else:
                    purch_dept = step_def.target_department or Department.objects.filter(
                        Q(code__in=['DEPT_PURCHASING', 'PURCHASING', 'PROC', 'PURCH']) |
                        Q(name__icontains='Purchasing') |
                        Q(name__icontains='Procurement')
                    ).first()
                    org_chain = WorkflowEngine.get_dept_approval_chain(purch_dept, company_code=company_code, requester=requester) if purch_dept else []

                if org_chain:
                    for idx, link in enumerate(org_chain):
                        step_status = ApprovalStep.StepStatus.WAITING if current_step_order == 1 else ApprovalStep.StepStatus.PENDING
                        if step_def.approver_type == WorkflowStepDefinition.ApproverType.PURCH_DEPT_HEAD:
                            if link.get('is_dept_head'):
                                req_inputs = []
                            else:
                                req_inputs = [i for i in (step_def.required_inputs or []) if (i.get('key') if isinstance(i, dict) else i) != 'po_number']
                        elif step_def.approver_type == WorkflowStepDefinition.ApproverType.REQ_DEPT_HEAD:
                            if idx == 0:
                                # Approver pertama dalam struktur organisasi yang memilih quotation
                                req_inputs = step_def.required_inputs or []
                            else:
                                # Approver berikutnya (Dept Head, GM, dll.) tidak perlu memilih quotation lagi
                                req_inputs = [
                                    i for i in (step_def.required_inputs or [])
                                    if (i.get('key') if isinstance(i, dict) else i) not in ('approval_quotation', 'quotation_selection', 'selected_quotation')
                                ]
                        else:
                            req_inputs = step_def.required_inputs or []

                        ApprovalStep.objects.create(
                            request=approval_request,
                            step_order=current_step_order,
                            name=f"{step_def.name} - {link['title']}",
                            approver_type=step_def.approver_type,
                            assigned_to=link['user'],
                            user_required=link['user'],
                            required_inputs=req_inputs,
                            status=step_status,
                        )
                        current_step_order += 1
                    continue
                else:
                    # Fallback to single Dept Head
                    assignee = None
                    if step_def.approver_type == WorkflowStepDefinition.ApproverType.REQ_DEPT_HEAD:
                        req_org = OrganizationStructure.objects.filter(user=requester).select_related('department', 'department__dept_head').first()
                        dept = req_org.department if req_org else None
                        if not dept and hasattr(requester, 'department') and requester.department:
                            dept = Department.objects.filter(Q(name=requester.department) | Q(code=requester.department)).first()
                        if dept:
                            assignee = dept.approver_2 or dept.approver_1 or dept.dept_head
                        else:
                            dept_node = OrganizationStructure.objects.filter(user__is_active=True, user__is_approver=True).select_related('user').first()
                            if dept_node:
                                assignee = dept_node.user
                    else:
                        purch_dept = step_def.target_department or Department.objects.filter(
                            Q(code__in=['DEPT_PURCHASING', 'PURCHASING', 'PROC', 'PURCH']) |
                            Q(name__icontains='Purchasing') |
                            Q(name__icontains='Procurement')
                        ).first()
                        if purch_dept and purch_dept.dept_head:
                            assignee = purch_dept.dept_head
                        else:
                            assignee = User.objects.filter(
                                Q(org_positions__department__name__icontains='Purchasing') |
                                Q(org_positions__department__name__icontains='Procurement') |
                                Q(user_roles__role__code__icontains='PURCHASING') |
                                Q(user_roles__role__code__icontains='PROCUREMENT'),
                                is_active=True, is_approver=True
                            ).distinct().first()

                    if step_def.approver_type == WorkflowStepDefinition.ApproverType.PURCH_DEPT_HEAD:
                        req_inputs = []
                    else:
                        req_inputs = step_def.required_inputs or []

                    step_status = ApprovalStep.StepStatus.WAITING if current_step_order == 1 else ApprovalStep.StepStatus.PENDING
                    ApprovalStep.objects.create(
                        request=approval_request,
                        step_order=current_step_order,
                        name=step_def.name,
                        approver_type=step_def.approver_type,
                        assigned_to=assignee,
                        required_inputs=req_inputs,
                        status=step_status,
                    )
                    current_step_order += 1
                    continue

            # Standard processing for non-REQ_DEPT_HEAD steps
            assignee = None
            if step_def.is_brand_conditional and step_def.master_workflow_criteria:
                payload_key = step_def.master_workflow_criteria.key_param_json
                master_code = payload.get(payload_key)
                if master_code:
                    try:
                        condition = Brand.objects.get(code=master_code, master_workflow_condition=step_def.master_workflow_criteria)
                        if condition.owner: assignee = condition.owner
                    except Brand.DoesNotExist:
                        pass

            if assignee is None:
                if step_def.approver_type == WorkflowStepDefinition.ApproverType.REQUESTOR:
                    assignee = requester
                elif step_def.approver_type == WorkflowStepDefinition.ApproverType.USER:
                    assignee = step_def.user_required
                elif step_def.approver_type == WorkflowStepDefinition.ApproverType.FINANCE_DEPT_HEAD:
                    fin_dept = Department.objects.filter(Q(code='DEPT_FIN') | Q(name__icontains='Finance')).first()
                    if fin_dept and fin_dept.dept_head:
                        assignee = fin_dept.dept_head
                    else:
                        assignee = User.objects.filter(Q(org_positions__department__name__icontains='Finance') | Q(user_roles__role__code__icontains='FINANCE'), is_active=True, is_approver=True).distinct().first()
                elif step_def.approver_type == WorkflowStepDefinition.ApproverType.TARGET_DEPT_ROLE:
                    if step_def.target_department and step_def.role_required:
                        assignee = User.objects.filter(org_positions__department=step_def.target_department, user_roles__role=step_def.role_required, is_active=True, is_approver=True).distinct().first()
                else:
                    assignee_qs = User.objects.filter(user_roles__role=step_def.role_required, is_active=True, is_approver=True)
                    if division_id: assignee_qs = assignee_qs.filter(division=division_id)
                    assignee = assignee_qs.first()

            step_status = ApprovalStep.StepStatus.PENDING
            if step_def.conditions:
                if not WorkflowEngine._evaluate_conditions(payload, step_def.conditions):
                    step_status = ApprovalStep.StepStatus.ADDITIONAL

            if current_step_order == 1 and step_status == ApprovalStep.StepStatus.PENDING:
                step_status = ApprovalStep.StepStatus.WAITING

            if step_status != ApprovalStep.StepStatus.ADDITIONAL:
                ApprovalStep.objects.create(
                    request=approval_request,
                    step_order=current_step_order,
                    name=step_def.name,
                    approver_type=step_def.approver_type,
                    assigned_to=assignee,
                    role_required=step_def.role_required,
                    user_required=assignee if step_def.approver_type == WorkflowStepDefinition.ApproverType.REQUESTOR else step_def.user_required,
                    target_department=step_def.target_department,
                    required_inputs=step_def.required_inputs,
                    status=step_status,
                )
                current_step_order += 1

        # Transition to IN_PROGRESS since first step is activated
        # But wait, what if the first step was skipped?
        first_active_step = approval_request.steps.filter(
            status=ApprovalStep.StepStatus.WAITING
        ).first()

        if not first_active_step:
            # If no steps are waiting, it might mean everything was skipped or first step skipped
            # Let's use the new activation logic to find the real first step
            approval_request.current_step = 0 # Start from before the first step
            WorkflowEngine._activate_next_step(approval_request)
        else:
            approval_request.status = ApprovalRequest.Status.IN_PROGRESS
            approval_request.save(update_fields=['status', 'updated_at'])

        # Create watchers if provided
        if watcher_ids:
            for user_id in watcher_ids:
                try:
                    watcher_user = User.objects.get(id=user_id)
                    RequestWatcher.objects.get_or_create(
                        request=approval_request,
                        user=watcher_user,
                        defaults={'created_by': requester}
                    )
                except User.DoesNotExist:
                    continue

        # Create audit log
        AuditLog.objects.create(
            request=approval_request,
            actor=requester,
            action=AuditLog.Action.SUBMITTED,
            details=f"Request submitted: {title}",
            ip_address=ip_address,
            payload_snapshot=payload,
        )

        # Send email to the first approver (step 1 is already WAITING at this point)
        first_waiting_step = approval_request.steps.filter(
            status=ApprovalStep.StepStatus.WAITING
        ).order_by('step_order').first()
        if first_waiting_step:
            _captured_step = first_waiting_step
            transaction.on_commit(lambda: email_service.send_step_notification(_captured_step))

        return approval_request

    @staticmethod
    def send_eorder_info_cc_notification(payload):
        """
        Send eOrder Information CC email notification for a given reference_id.
        """
        return transaction.on_commit(lambda: email_service.send_eorder_info_cc_notification(payload))
        


    @staticmethod
    def _is_user_authorized_for_step(approver, current_step, approval_request):
        """Check if an approver is authorized to take action on the given step."""
        if approver.is_superuser:
            return True
        if current_step.assigned_to and current_step.assigned_to == approver:
            return True
        if current_step.user_required and current_step.user_required == approver:
            return True
        if current_step.approver_type == WorkflowStepDefinition.ApproverType.REQUESTOR:
            if approval_request.requester == approver:
                return True
        elif current_step.approver_type == WorkflowStepDefinition.ApproverType.REQ_DEPT_HEAD:
            req_dept = approval_request.requester.department
            dept_obj = Department.objects.filter(Q(name=req_dept) | Q(code=req_dept)).first()
            if dept_obj and approver in dept_obj.get_approvers():
                return True
            elif approver.department == req_dept and (approver.is_approver or approver.user_roles.filter(role__code__in=['MGR', 'DEPT_HEAD']).exists()):
                return True
            elif approver.headed_departments.filter(Q(code=req_dept) | Q(name=req_dept)).exists():
                return True
        elif current_step.approver_type == WorkflowStepDefinition.ApproverType.FINANCE_DEPT_HEAD:
            if 'finance' in (approver.department or '').lower() or approver.user_roles.filter(role__code__icontains='FINANCE').exists():
                return True
        elif current_step.approver_type == WorkflowStepDefinition.ApproverType.PURCH_DEPT_HEAD:
            purch_dept = current_step.target_department or Department.objects.filter(
                Q(code__in=['DEPT_PURCHASING', 'PURCHASING', 'PROC', 'PURCH']) |
                Q(name__icontains='Purchasing') |
                Q(name__icontains='Procurement')
            ).first()
            app_org = OrganizationStructure.objects.filter(user=approver).first()
            app_dept_name = app_org.department.name if app_org and app_org.department else ''
            if (purch_dept and app_org and app_org.department_id == purch_dept.id) or \
               'purchasing' in app_dept_name.lower() or 'procurement' in app_dept_name.lower() or \
               approver.user_roles.filter(Q(role__code__icontains='PURCHASING') | Q(role__code__icontains='PROCUREMENT')).exists():
                return True
        elif current_step.approver_type == WorkflowStepDefinition.ApproverType.TARGET_DEPT_ROLE:
            target_dept = current_step.target_department
            if target_dept:
                approver_dept_ids = approver.get_department_ids() if hasattr(approver, 'get_department_ids') else []
                if (
                    target_dept.id in approver_dept_ids or
                    OrganizationStructure.objects.filter(user=approver, department=target_dept).exists() or
                    approver.department_ref == target_dept or
                    (approver.department and (
                        approver.department.strip().lower() == target_dept.name.strip().lower() or
                        approver.department.strip().lower() == (target_dept.code or '').strip().lower()
                    )) or
                    approver.user_roles.filter(
                        Q(dept__iexact=target_dept.name) | Q(dept__iexact=target_dept.code)
                    ).exists()
                ):
                    return True
        elif current_step.role_required:
            if approver.user_roles.filter(role=current_step.role_required).exists():
                if not approval_request.division or approver.division == approval_request.division:
                    return True
                else:
                    raise ValidationError(f"You are not authorized to approve requests for division '{approval_request.division}'.")

        return False

    @staticmethod
    @transaction.atomic
    def approve_step(request_id, approver, comments='', ip_address=None, dlvdate=None, step_data=None):
        """
        Approve the current step of an approval request.
        If this is the final step, the entire request is marked as APPROVED.
        Otherwise, advances to the next step.

        Args:
            request_id (int): ID of the ApprovalRequest.
            approver (User): User performing the approval.
            comments (str): Optional approval comments.
            ip_address (str): IP address of the approver.
            dlvdate (str): Optional delivery date provided during approval.
            step_data (dict): Optional metadata entered by approver (e.g., PO Number & Quotation).

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
        if not WorkflowEngine._is_user_authorized_for_step(approver, current_step, approval_request):
            raise ValidationError("You are not authorized to approve this step.")

        # Validate required_inputs if defined for this step
        if current_step.required_inputs:
            step_data = step_data or {}
            missing_fields = []
            for field in current_step.required_inputs:
                field_key = field.get('key') if isinstance(field, dict) else field
                if not step_data.get(field_key):
                    field_label = field.get('label', field_key) if isinstance(field, dict) else field_key
                    missing_fields.append(str(field_label))
            if missing_fields:
                raise ValidationError(f"Data wajib berikut harus diisi sebelum Approve: {', '.join(missing_fields)}")

        acted_step = current_step

        if dlvdate or step_data:
            if not isinstance(approval_request.payload, dict):
                approval_request.payload = {}
            if dlvdate:
                approval_request.payload['dlvdate'] = dlvdate
            if step_data:
                approval_request.payload.update(step_data)
            approval_request.save(update_fields=['payload', 'updated_at'])

        # Approve the current step
        current_step.status = ApprovalStep.StepStatus.APPROVED
        current_step.assigned_to = approver
        current_step.comments = comments
        if step_data:
            current_step.step_data = step_data
        current_step.acted_at = timezone.now()
        current_step.save()

        # Activate the next step using the new helper
        WorkflowEngine._activate_next_step(approval_request)

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
        _captured_dlvdate = dlvdate
        _captured_step = acted_step
        transaction.on_commit(lambda: WorkflowEngine.notify_external_system(
            approval_request, dlvdate=_captured_dlvdate, acted_step=_captured_step, approver=approver
        ))

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
        if not WorkflowEngine._is_user_authorized_for_step(approver, current_step, approval_request):
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

        # Reject all subsequent steps that are not already acted upon
        ApprovalStep.objects.filter(
            request=approval_request,
            step_order__gt=current_step.step_order
        ).exclude(
            status__in=[ApprovalStep.StepStatus.APPROVED, ApprovalStep.StepStatus.SKIPPED]
        ).update(status=ApprovalStep.StepStatus.SKIPPED)

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
        _captured_step = current_step
        _captured_approver = approver
        transaction.on_commit(lambda: WorkflowEngine.notify_external_system(
            approval_request, acted_step=_captured_step, approver=_captured_approver
        ))

        # Notify requester about rejection via email
        _captured_req = approval_request
        _captured_step = current_step
        transaction.on_commit(lambda: email_service.send_rejected_notification(_captured_req, _captured_step))

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
            elif current_step.approver_type == WorkflowStepDefinition.ApproverType.REQUESTOR:
                is_authorized = (approval_request.requester == current_user)
            elif current_step.approver_type == WorkflowStepDefinition.ApproverType.TARGET_DEPT_ROLE:
                target_dept = current_step.target_department
                if target_dept:
                    curr_dept_ids = current_user.get_department_ids() if hasattr(current_user, 'get_department_ids') else []
                    if (
                        target_dept.id in curr_dept_ids or
                        OrganizationStructure.objects.filter(user=current_user, department=target_dept).exists() or
                        current_user.department_ref == target_dept or
                        (current_user.department and (
                            current_user.department.strip().lower() == target_dept.name.strip().lower() or
                            current_user.department.strip().lower() == (target_dept.code or '').strip().lower()
                        )) or
                        current_user.user_roles.filter(
                            Q(dept__iexact=target_dept.name) | Q(dept__iexact=target_dept.code)
                        ).exists()
                    ):
                        is_authorized = True
            
            if not is_authorized and current_step.role_required:
                is_authorized = current_user.user_roles.filter(role=current_step.role_required).exists()

        if not is_authorized:
            raise ValidationError("You are not authorized to delegate this step.")

        # Validate new assignee has the required role (if role-based)
        if current_step.role_required and not current_step.user_required:
            if not new_assignee.user_roles.filter(role=current_step.role_required).exists():
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

    @staticmethod
    @transaction.atomic
    def revise_step(request_id, approver, comments='', ip_address=None):
        """
        Revise the workflow from the current active step back to the upload quotation step.
        Applicable when a request is IN_PROGRESS and current step is after the quotation upload step
        (e.g., Approval 1, Approval 2, or Purchasing Team).
        Steps between quotation upload and current step are reset to PENDING.
        Target quotation upload step is set to WAITING.
        Activity log (AuditLog) records the revision.

        Args:
            request_id (int): ID of the ApprovalRequest.
            approver (User): User requesting the revision (must be authorized for current step).
            comments (str): Reason for revision (required).
            ip_address (str): IP address.

        Returns:
            ApprovalRequest: The updated approval request.
        """
        try:
            approval_request = ApprovalRequest.objects.select_for_update().get(id=request_id)
        except ApprovalRequest.DoesNotExist:
            raise ValidationError(f"Approval request {request_id} not found.")

        if approval_request.status != ApprovalRequest.Status.IN_PROGRESS:
            raise ValidationError(
                f"Cannot revise: request is in '{approval_request.status}' state."
            )

        try:
            current_step = ApprovalStep.objects.get(
                request=approval_request,
                step_order=approval_request.current_step,
                status=ApprovalStep.StepStatus.WAITING,
            )
        except ApprovalStep.DoesNotExist:
            raise ValidationError("No active step found for this request.")

        if not WorkflowEngine._is_user_authorized_for_step(approver, current_step, approval_request):
            raise ValidationError("You are not authorized to revise this step.")

        if not comments or not comments.strip():
            raise ValidationError("Alasan revisi wajib diisi.")

        # Find preceding quotation upload step (required_inputs contains 'quotation')
        quotation_step = None
        for prev_step in approval_request.steps.filter(step_order__lt=current_step.step_order).order_by('-step_order'):
            req_inputs = prev_step.required_inputs or []
            keys = [(k.get('key') if isinstance(k, dict) else k) for k in req_inputs]
            if 'quotation' in keys:
                quotation_step = prev_step
                break

        if quotation_step:
            # === ALUR A: Revisi Quotation (Setelah Upload Quotation) ===
            # Record comments on current step before resetting
            current_step.comments = comments.strip()
            current_step.save(update_fields=['comments'])

            # Reset intermediate and current steps back to PENDING
            steps_to_reset = approval_request.steps.filter(
                step_order__gt=quotation_step.step_order,
                step_order__lte=current_step.step_order
            )
            for s in steps_to_reset:
                s.status = ApprovalStep.StepStatus.PENDING
                s.acted_at = None
                if s.step_data and isinstance(s.step_data, dict):
                    s.step_data.pop('approval_quotation', None)
                    s.save(update_fields=['status', 'acted_at', 'step_data'])
                else:
                    s.save(update_fields=['status', 'acted_at'])

            # Ensure all subsequent steps remain PENDING
            approval_request.steps.filter(
                step_order__gt=current_step.step_order
            ).exclude(
                status=ApprovalStep.StepStatus.SKIPPED
            ).update(
                status=ApprovalStep.StepStatus.PENDING,
                acted_at=None
            )

            # Set quotation upload step to WAITING
            quotation_step.status = ApprovalStep.StepStatus.WAITING
            quotation_step.acted_at = None
            quotation_step.save(update_fields=['status', 'acted_at'])

            # Update approval_request current_step and payload
            approval_request.current_step = quotation_step.step_order
            if isinstance(approval_request.payload, dict) and 'approval_quotation' in approval_request.payload:
                approval_request.payload.pop('approval_quotation', None)
                approval_request.save(update_fields=['current_step', 'payload', 'updated_at'])
            else:
                approval_request.save(update_fields=['current_step', 'updated_at'])

            # Create AuditLog entry
            log_details = f"Step {current_step.step_order} ({current_step.name}) direvisi oleh {approver.get_full_name() or approver.username} kembali ke Step {quotation_step.step_order} ({quotation_step.name}). Alasan: {comments.strip()}"
            AuditLog.objects.create(
                request=approval_request,
                step=current_step,
                actor=approver,
                action=AuditLog.Action.REVISED,
                details=log_details,
                ip_address=ip_address,
                payload_snapshot=approval_request.payload,
            )

            # Notify external system and email
            _captured_current_step = current_step
            _captured_target_step = quotation_step
            _captured_approver = approver
            transaction.on_commit(lambda: WorkflowEngine.notify_external_system(
                approval_request, acted_step=_captured_current_step, approver=_captured_approver
            ))
            transaction.on_commit(lambda: email_service.send_step_notification(_captured_target_step))

            return approval_request

        else:
            # === ALUR B: Revisi PR Form (Sebelum / Pada Saat Upload Quotation) ===
            current_step.comments = comments.strip()
            current_step.save(update_fields=['comments'])

            # Find linked PRNonTrade
            pr = None
            if hasattr(approval_request, 'pr_non_trade_headers'):
                pr = approval_request.pr_non_trade_headers.first()
            if not pr and approval_request.reference_id:
                from core.models import PRNonTrade
                pr = PRNonTrade.objects.filter(transaction_id=approval_request.reference_id).first()

            if pr:
                pr.status = 'REVISE'
                pr.save(update_fields=['status', 'updated_at'])

            # Reset steps: all steps become PENDING
            for s in approval_request.steps.all().exclude(status=ApprovalStep.StepStatus.SKIPPED):
                s.status = ApprovalStep.StepStatus.PENDING
                s.acted_at = None
                if s.step_data and isinstance(s.step_data, dict):
                    s.step_data.pop('approval_quotation', None)
                    s.save(update_fields=['status', 'acted_at', 'step_data'])
                else:
                    s.save(update_fields=['status', 'acted_at'])

            # Set approval request status to REVISED, reset current_step to 1
            approval_request.status = ApprovalRequest.Status.REVISED
            approval_request.current_step = 1
            if isinstance(approval_request.payload, dict) and 'approval_quotation' in approval_request.payload:
                approval_request.payload.pop('approval_quotation', None)
                approval_request.save(update_fields=['status', 'current_step', 'payload', 'updated_at'])
            else:
                approval_request.save(update_fields=['status', 'current_step', 'updated_at'])

            # Create AuditLog entry
            requester_name = approval_request.requester.get_full_name() or approval_request.requester.username
            log_details = (
                f"Step {current_step.step_order} ({current_step.name}) direvisi oleh "
                f"{approver.get_full_name() or approver.username}. Alasan: {comments.strip()}. "
                f"Status PR Form diubah menjadi REVISE untuk diedit kembali oleh pemohon ({requester_name})."
            )
            AuditLog.objects.create(
                request=approval_request,
                step=current_step,
                actor=approver,
                action=AuditLog.Action.REVISED,
                details=log_details,
                ip_address=ip_address,
                payload_snapshot=approval_request.payload,
            )

            # Send email notification to requester
            _captured_current_step = current_step
            _captured_approver = approver
            _captured_comments = comments.strip()
            transaction.on_commit(lambda: WorkflowEngine.notify_external_system(
                approval_request, acted_step=_captured_current_step, approver=_captured_approver
            ))
            transaction.on_commit(lambda: email_service.send_revised_to_requester_notification(
                approval_request, _captured_current_step, revisor=_captured_approver, comments=_captured_comments
            ))

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

        if approval_request.status not in (ApprovalRequest.Status.REJECTED, ApprovalRequest.Status.REVISED):
            raise ValidationError("Only rejected or revised requests can be revised.")

        if approval_request.requester != requester:
            raise ValidationError("Only the original requester can revise this request.")

        # Update linked PRNonTrade status if exists
        if hasattr(approval_request, 'pr_non_trade_headers') and approval_request.pr_non_trade_headers.exists():
            approval_request.pr_non_trade_headers.update(status='SUBMITTED')
        elif approval_request.reference_id:
            from core.models import PRNonTrade
            PRNonTrade.objects.filter(transaction_id=approval_request.reference_id).update(status='SUBMITTED')

        # Update payload if provided
        if updated_payload:
            approval_request.payload = updated_payload

        # Transition: REJECTED → REVISED → PENDING
        approval_request.status = ApprovalRequest.Status.REVISED
        approval_request.save(update_fields=['status', 'payload', 'updated_at'])

        # Reset all steps and re-evaluate conditions
        step_definitions = {
            sd.step_order: sd for sd in approval_request.workflow.steps.all()
        }
        
        for step in approval_request.steps.all().order_by('step_order'):
            step.comments = ''
            step.acted_at = None
            
            step_def = step_definitions.get(step.step_order)
            if step_def and step_def.conditions:
                if not WorkflowEngine._evaluate_conditions(approval_request.payload, step_def.conditions):
                    step.status = ApprovalStep.StepStatus.SKIPPED
                else:
                    step.status = ApprovalStep.StepStatus.PENDING
            else:
                step.status = ApprovalStep.StepStatus.PENDING
            step.save()

        # Reset request state and activate first non-skipped step
        approval_request.status = ApprovalRequest.Status.PENDING
        approval_request.current_step = 0
        approval_request.save(update_fields=['status', 'current_step', 'updated_at'])

        # This will set the first WAITING step and change request status to IN_PROGRESS (if not finished)
        is_finished = WorkflowEngine._activate_next_step(approval_request)
        if not is_finished:
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
