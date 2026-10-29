from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import (
    Company,
    Department,
    OrganizationStructure,
    Module,
    WorkflowDefinition,
    WorkflowStepDefinition,
    ApprovalRequest,
    ApprovalStep,
    AuditLog
)
from core.engine import WorkflowEngine

User = get_user_model()


class WorkflowEngineOrgStructureTest(TestCase):
    def setUp(self):
        # 1. Create Company and Department
        self.company = Company.objects.create(code='PTBSJ', name='PT Bintang Sinar Jaya')
        self.dept = Department.objects.create(company=self.company, code='PROC', name='Procurement & Logistics')

        # 2. Create Users
        self.staff = User.objects.create_user(
            username='staff_user',
            email='staff@test.com',
            password='password123'
        )
        self.manager = User.objects.create_user(
            username='mgr_user',
            email='mgr@test.com',
            password='password123'
        )
        self.dept_head = User.objects.create_user(
            username='dept_head_user',
            email='dh@test.com',
            password='password123'
        )
        self.finance_user = User.objects.create_user(
            username='finance_user',
            email='finance@test.com',
            password='password123'
        )

        # 3. Create Org Structure: Staff -> Manager -> Dept Head
        self.org_dh = OrganizationStructure.objects.create(
            company=self.company,
            user=self.dept_head,
            department=self.dept,
            position_title='Department Head Procurement',
            level_order=1,
            reports_to=None,
            is_dept_head=True
        )
        self.org_mgr = OrganizationStructure.objects.create(
            company=self.company,
            user=self.manager,
            department=self.dept,
            position_title='Procurement Manager',
            level_order=2,
            reports_to=self.dept_head,
            is_dept_head=False
        )
        self.org_staff = OrganizationStructure.objects.create(
            company=self.company,
            user=self.staff,
            department=self.dept,
            position_title='Procurement Staff',
            level_order=3,
            reports_to=self.manager,
            is_dept_head=False
        )

        # 4. Create Module & Workflow Definition with REQ_DEPT_HEAD and FINANCE_DEPT_HEAD steps
        self.module = Module.objects.create(code='EORDER', name='E-Order System')
        self.workflow = WorkflowDefinition.objects.create(
            name='PR Approval Workflow',
            module=self.module,
            is_active=True
        )

        self.step_dept = WorkflowStepDefinition.objects.create(
            workflow=self.workflow,
            step_order=1,
            name='Department Approval',
            approver_type='REQ_DEPT_HEAD'
        )

        self.step_fin = WorkflowStepDefinition.objects.create(
            workflow=self.workflow,
            step_order=2,
            name='Purchasing Approval',
            approver_type='FINANCE_DEPT_HEAD',
            user_required=self.finance_user,
            required_inputs=['po_number', 'quotation']
        )

    def test_get_org_approval_chain(self):
        chain = WorkflowEngine.get_org_approval_chain(self.staff, 'PTBSJ')
        self.assertEqual(len(chain), 2)
        self.assertEqual(chain[0]['user'], self.manager)
        self.assertEqual(chain[1]['user'], self.dept_head)

    def test_submit_request_dynamic_org_expansion(self):
        payload = {
            "reference_id": "PR-2026-001",
            "company_code": "PTBSJ",
            "total_amount": 15000000
        }
        req = WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=self.workflow.id,
            requester=self.staff,
            title="PR Purchase Test",
            payload=payload,
            description="Testing dynamic org expansion"
        )

        steps = list(req.steps.all().order_by('step_order'))
        # Should expand REQ_DEPT_HEAD (2 approvers: Manager & Dept Head) + FINANCE_DEPT_HEAD (1 approver) = 3 steps
        self.assertEqual(len(steps), 3)

        self.assertEqual(steps[0].user_required, self.manager)
        self.assertEqual(steps[0].status, 'WAITING')

        self.assertEqual(steps[1].user_required, self.dept_head)
        self.assertEqual(steps[1].status, 'PENDING')

        self.assertEqual(steps[2].user_required, self.finance_user)
        self.assertEqual(steps[2].status, 'PENDING')

    def test_finance_step_required_inputs(self):
        payload = {
            "reference_id": "PR-2026-002",
            "company_code": "PTBSJ"
        }
        req = WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=self.workflow.id,
            requester=self.staff,
            title="PR Purchasing Inputs Test",
            payload=payload,
            description="Testing required inputs on finance step"
        )

        # Approve Department steps (steps 1 & 2: Manager & Dept Head)
        for i in range(2):
            current_step = req.steps.get(step_order=i+1)
            WorkflowEngine.approve_step(req.id, current_step.user_required, comments=f"Approved step {i+1}")

        fin_step = req.steps.get(step_order=3)
        self.assertEqual(fin_step.status, 'WAITING')

        # Approve finance step with po_number and quotation
        step_data = {
            "po_number": "PO/2026/0099",
            "quotation": "QUOT-8821"
        }
        WorkflowEngine.approve_step(req.id, self.finance_user, comments="PO & Quotation attached", step_data=step_data)

        fin_step.refresh_from_db()
        self.assertEqual(fin_step.status, 'APPROVED')
        self.assertEqual(fin_step.step_data, step_data)

        req.refresh_from_db()
        self.assertEqual(req.status, 'APPROVED')
        self.assertEqual(req.payload.get('po_number'), 'PO/2026/0099')
        self.assertEqual(req.payload.get('quotation'), 'QUOT-8821')

    def test_approve_api_with_quotation_files_array(self):
        from rest_framework.test import APIClient
        payload = {"reference_id": "PR-2026-003", "company_code": "PTBSJ"}
        req = WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=self.workflow.id,
            requester=self.staff,
            title="Quotation File Array API Test",
            payload=payload,
            description="Testing quotation array input on approve API"
        )
        # Approve first 2 steps
        for i in range(2):
            current_step = req.steps.get(step_order=i+1)
            WorkflowEngine.approve_step(req.id, current_step.user_required, comments=f"Approved step {i+1}")

        client = APIClient()
        client.force_authenticate(user=self.finance_user)
        quotation_files = [
            {"name": "penawaran.pdf", "size": 1024, "type": "application/pdf", "data": "data:application/pdf;base64,AAA"}
        ]
        response = client.post(
            f"/api/v1/workflow/{req.id}/approve",
            data={
                "comments": "Approved with quotation attachment",
                "po_number": "PO-12345",
                "quotation": quotation_files,
                "step_data": {"po_number": "PO-12345", "quotation": quotation_files}
            },
            format="json"
        )
        self.assertEqual(response.status_code, 200)
        req.refresh_from_db()
        self.assertEqual(req.status, 'APPROVED')
        self.assertEqual(req.payload.get('quotation'), quotation_files)

    def test_req_dept_head_approval_quotation_only_on_first_step(self):
        """
        Verify that when REQ_DEPT_HEAD has required_inputs=['approval_quotation'],
        only the 1st step in the org chain (Manager) gets required_inputs=['approval_quotation'].
        Subsequent steps (Dept Head) have required_inputs without 'approval_quotation'.
        """
        from rest_framework.exceptions import ValidationError

        wf = WorkflowDefinition.objects.create(
            name='Quotation Selection Workflow',
            module=self.module,
            is_active=True
        )
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=1,
            name='Org Review & Quotation Choice',
            approver_type='REQ_DEPT_HEAD',
            required_inputs=['approval_quotation']
        )

        req = WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=wf.id,
            requester=self.staff,
            title="Quotation Selection Test",
            payload={"company_code": "PTBSJ"}
        )

        steps = list(req.steps.all().order_by('step_order'))
        self.assertEqual(len(steps), 2)

        # Step 1: Manager (First approver in org structure)
        self.assertEqual(steps[0].user_required, self.manager)
        self.assertEqual(steps[0].required_inputs, ['approval_quotation'])

        # Step 2: Dept Head (Second approver in org structure) -> MUST NOT have approval_quotation
        self.assertEqual(steps[1].user_required, self.dept_head)
        self.assertEqual(steps[1].required_inputs, [])

        # Attempt to approve step 1 without approval_quotation -> must raise ValidationError
        with self.assertRaises(ValidationError) as ctx:
            WorkflowEngine.approve_step(req.id, self.manager, comments="Approving without quotation")
        self.assertIn("approval_quotation", str(ctx.exception))

        # Approve step 1 with approval_quotation
        selected_quot = {
            "name": "Vendor_A_Quotation.pdf",
            "size": 2048,
            "type": "application/pdf"
        }
        WorkflowEngine.approve_step(
            req.id,
            self.manager,
            comments="Approved Vendor A",
            step_data={"approval_quotation": selected_quot}
        )

        steps[0].refresh_from_db()
        self.assertEqual(steps[0].status, 'APPROVED')
        self.assertEqual(steps[0].step_data.get('approval_quotation'), selected_quot)

        req.refresh_from_db()
        self.assertEqual(req.payload.get('approval_quotation'), selected_quot)

        # Step 2: Dept Head approves WITHOUT supplying approval_quotation -> should succeed!
        steps[1].refresh_from_db()
        self.assertEqual(steps[1].status, 'WAITING')
        WorkflowEngine.approve_step(
            req.id,
            self.dept_head,
            comments="Dept Head approves Vendor A choice"
        )

        steps[1].refresh_from_db()
        self.assertEqual(steps[1].status, 'APPROVED')

        req.refresh_from_db()
        self.assertEqual(req.status, 'APPROVED')

    def test_revise_step_from_approval_1_and_2_and_purchasing(self):
        """
        Verify revision after upload quotation step:
        - Approval 1 can revise -> returns to upload quotation step
        - Approval 2 can revise -> returns to upload quotation step
        - Purchasing team can revise -> returns to upload quotation step
        - All revisions are logged in AuditLog
        """
        from rest_framework.exceptions import ValidationError

        purchasing_user = User.objects.create_user(
            username='purch_staff',
            email='purch@test.com',
            password='password123'
        )
        purch_dept = Department.objects.create(name='Purchasing Dept', code='DEPT_PURCHASING')
        OrganizationStructure.objects.create(
            company=self.company,
            user=purchasing_user,
            department=purch_dept,
            position_title='Purchasing Buyer',
            level_order=1
        )

        wf = WorkflowDefinition.objects.create(
            name='PR Revision Workflow',
            module=self.module,
            is_active=True
        )
        # Step 1: Upload Quotation (Purchasing)
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=1,
            name='Purchasing Upload Quotation',
            approver_type='USER',
            user_required=purchasing_user,
            required_inputs=['quotation']
        )
        # Step 2: Approval 1 (Quotation Choice)
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=2,
            name='Quotation Review - Approval 1',
            approver_type='USER',
            user_required=self.manager,
            required_inputs=['approval_quotation']
        )
        # Step 3: Approval 2 (Quotation Review Dept Head)
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=3,
            name='Quotation Review - Approval 2',
            approver_type='USER',
            user_required=self.dept_head
        )
        # Step 4: Purchasing Team Review
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=4,
            name='Purchasing Team Review',
            approver_type='USER',
            user_required=purchasing_user
        )

        req = WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=wf.id,
            requester=self.staff,
            title="PR Revision Test",
            payload={"company_code": "PTBSJ"}
        )

        steps = list(req.steps.all().order_by('step_order'))
        self.assertEqual(len(steps), 4)

        # 1. Purchasing uploads quotation
        quot_file = {"name": "Vendor_X.pdf", "size": 1024, "type": "application/pdf"}
        WorkflowEngine.approve_step(
            req.id,
            purchasing_user,
            comments="Quotation uploaded",
            step_data={"quotation": [quot_file]}
        )
        req.refresh_from_db()
        self.assertEqual(req.current_step, 2)

        # 2. Approval 1 performs revise
        WorkflowEngine.revise_step(
            req.id,
            self.manager,
            comments="Tolong cari vendor lain yang lebih murah"
        )
        req.refresh_from_db()
        self.assertEqual(req.current_step, 1)

        steps[0].refresh_from_db()
        steps[1].refresh_from_db()
        self.assertEqual(steps[0].status, 'WAITING')
        self.assertEqual(steps[1].status, 'PENDING')

        # Verify AuditLog
        rev_log_1 = AuditLog.objects.filter(request=req, action=AuditLog.Action.REVISED).last()
        self.assertIsNotNone(rev_log_1)
        self.assertEqual(rev_log_1.actor, self.manager)
        self.assertIn("kembali ke Step 1", rev_log_1.details)
        self.assertIn("Tolong cari vendor lain yang lebih murah", rev_log_1.details)

        # 3. Purchasing re-uploads new quotation
        quot_file_2 = {"name": "Vendor_Y.pdf", "size": 2048, "type": "application/pdf"}
        WorkflowEngine.approve_step(
            req.id,
            purchasing_user,
            comments="Uploaded Vendor Y quotation",
            step_data={"quotation": [quot_file_2]}
        )
        req.refresh_from_db()
        self.assertEqual(req.current_step, 2)

        # 4. Approval 1 approves with chosen quotation
        WorkflowEngine.approve_step(
            req.id,
            self.manager,
            comments="Approved Vendor Y",
            step_data={"approval_quotation": quot_file_2}
        )
        req.refresh_from_db()
        self.assertEqual(req.current_step, 3)

        # 5. Approval 2 performs revise
        WorkflowEngine.revise_step(
            req.id,
            self.dept_head,
            comments="Spesifikasi teknis belum sesuai, mohon revisi quotation"
        )
        req.refresh_from_db()
        self.assertEqual(req.current_step, 1)
        self.assertNotIn('approval_quotation', req.payload)

        steps[0].refresh_from_db()
        steps[1].refresh_from_db()
        steps[2].refresh_from_db()
        self.assertEqual(steps[0].status, 'WAITING')
        self.assertEqual(steps[1].status, 'PENDING')
        self.assertEqual(steps[2].status, 'PENDING')

        # 6. Re-advance through Step 1, 2, 3 to Step 4
        WorkflowEngine.approve_step(req.id, purchasing_user, comments="Re-uploaded", step_data={"quotation": [quot_file_2]})
        WorkflowEngine.approve_step(req.id, self.manager, comments="Re-approved", step_data={"approval_quotation": quot_file_2})
        WorkflowEngine.approve_step(req.id, self.dept_head, comments="Approved Dept Head")
        req.refresh_from_db()
        self.assertEqual(req.current_step, 4)

        # 7. Purchasing Team performs revise from Step 4
        WorkflowEngine.revise_step(
            req.id,
            purchasing_user,
            comments="Vendor Y diskualifikasi karena syarat legalitas"
        )
        req.refresh_from_db()
        self.assertEqual(req.current_step, 1)
        steps[0].refresh_from_db()
        steps[3].refresh_from_db()
        self.assertEqual(steps[0].status, 'WAITING')
        self.assertEqual(steps[3].status, 'PENDING')

        # Total 3 revisions recorded in AuditLog
        rev_count = AuditLog.objects.filter(request=req, action=AuditLog.Action.REVISED).count()
        self.assertEqual(rev_count, 3)

    def test_revise_api_endpoint(self):
        """Test POST /api/v1/workflow/<id>/revise endpoint."""
        from rest_framework.test import APIClient

        wf = WorkflowDefinition.objects.create(
            name='PR API Revision Workflow',
            module=self.module,
            is_active=True
        )
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=1,
            name='Quotation Upload',
            approver_type='USER',
            user_required=self.manager,
            required_inputs=['quotation']
        )
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=2,
            name='Quotation Approval',
            approver_type='USER',
            user_required=self.dept_head,
            required_inputs=['approval_quotation']
        )

        req = WorkflowEngine.submit_request(
            module_code='EORDER',
            workflow_id=wf.id,
            requester=self.staff,
            title="PR API Test",
            payload={"company_code": "PTBSJ"}
        )

        # Approve step 1
        WorkflowEngine.approve_step(req.id, self.manager, step_data={"quotation": ["file1.pdf"]})

        client = APIClient()
        client.force_authenticate(user=self.dept_head)

        # Call revise API
        response = client.post(
            f'/api/v1/workflow/{req.id}/revise',
            {"comments": "Mohon cari vendor alternatif"},
            format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get('success'))
        self.assertEqual(response.data.get('data', {}).get('current_step'), 1)

    def test_revise_step_before_quotation_pr_form(self):
        """Test revising PR Form at a step before quotation upload and resubmitting."""
        from core.models import PRNonTrade, PRNonTradeItem, Module
        from rest_framework.test import APIClient

        pr_module, _ = Module.objects.get_or_create(code='PR_NON_TRADE', defaults={'name': 'PR Non Trade', 'is_active': True})
        wf = WorkflowDefinition.objects.create(
            name='PR Review & Quotation WF',
            module=pr_module,
            is_active=True
        )
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=1,
            name='Dept Review',
            approver_type='USER',
            user_required=self.manager
        )
        WorkflowStepDefinition.objects.create(
            workflow=wf,
            step_order=2,
            name='Purchasing Submission Quotation',
            approver_type='USER',
            user_required=self.dept_head,
            required_inputs=['quotation']
        )

        # 1. Create and submit PRNonTrade
        pr = PRNonTrade.objects.create(
            transaction_id='PR/HO/NT/2026/000099',
            requestor=self.staff,
            requestor_name='Staff User',
            purpose='Pengadaan Laptop Dev',
            status='SUBMITTED'
        )
        PRNonTradeItem.objects.create(
            pr_non_trade=pr,
            item_order=1,
            goods_name='Laptop 16GB',
            quantity=2
        )

        req = WorkflowEngine.submit_request(
            module_code='PR_NON_TRADE',
            workflow_id=wf.id,
            requester=self.staff,
            title="PR Non Trade - PR/HO/NT/2026/000099",
            payload={"transaction_id": pr.transaction_id, "purpose": pr.purpose},
            reference_id=pr.transaction_id
        )
        pr.approval_request = req
        pr.save()

        self.assertEqual(req.current_step, 1)
        self.assertEqual(pr.status, 'SUBMITTED')

        # 2. Dept Review (manager) performs revise from Step 1
        WorkflowEngine.revise_step(
            req.id,
            self.manager,
            comments="Spesifikasi RAM perlu dinaikkan ke 32GB"
        )

        pr.refresh_from_db()
        req.refresh_from_db()

        # PR status becomes REVISE
        self.assertEqual(pr.status, 'REVISE')
        self.assertEqual(req.status, 'REVISED')
        self.assertEqual(req.current_step, 1)

        # AuditLog recorded
        audit = AuditLog.objects.filter(request=req, action=AuditLog.Action.REVISED).latest('id')
        self.assertIn('REVISE', audit.details)
        self.assertIn('32GB', audit.details)

        # 3. Requestor resubmits the edited PR form via API
        client = APIClient()
        client.force_authenticate(user=self.staff)
        res = client.post(
            '/api/v1/pr-non-trade/submit/',
            {
                'id': pr.id,
                'purpose': 'Pengadaan Laptop Dev 32GB',
                'items': [
                    {'goods_name': 'Laptop 32GB', 'quantity': 2, 'unit': 'UNIT'}
                ]
            },
            format='json'
        )
        self.assertEqual(res.status_code, 200)

        pr.refresh_from_db()
        req.refresh_from_db()

        self.assertEqual(pr.status, 'SUBMITTED')
        self.assertEqual(req.status, 'IN_PROGRESS')
        self.assertEqual(req.current_step, 1)
        self.assertEqual(req.steps.get(step_order=1).status, 'WAITING')
        self.assertEqual(req.payload.get('purpose'), 'Pengadaan Laptop Dev 32GB')

        # AuditLog recorded for resubmission
        resubmit_audit = AuditLog.objects.filter(request=req, action=AuditLog.Action.SUBMITTED).latest('id')
        self.assertIn('disubmit ulang', resubmit_audit.details)


class CCEmailConfigTest(TestCase):
    def setUp(self):
        from core.models import CCEmailConfig
        CCEmailConfig.objects.create(email='all_dist@test.com', subject='eorder information', ship_to='all', is_active=True)
        CCEmailConfig.objects.create(email='dist1@test.com', subject='eorder information', ship_to='10001', is_active=True)
        CCEmailConfig.objects.create(email='dist2@test.com', subject='eorder information', ship_to='10002', is_active=True)
        CCEmailConfig.objects.create(email='general@test.com', subject='eorder information', ship_to=None, is_active=True)
        CCEmailConfig.objects.create(email='inactive@test.com', subject='eorder information', ship_to='10001', is_active=False)

    def test_get_cc_emails_specific_ship_to(self):
        from core.email_service import _get_cc_emails_for_subject
        emails = _get_cc_emails_for_subject('eorder information', ship_to='10001')
        self.assertIn('dist1@test.com', emails)
        self.assertIn('all_dist@test.com', emails)
        self.assertIn('general@test.com', emails)
        self.assertNotIn('dist2@test.com', emails)
        self.assertNotIn('inactive@test.com', emails)

    def test_get_cc_emails_payload_ship_to_all(self):
        from core.email_service import _get_cc_emails_for_subject
        emails = _get_cc_emails_for_subject('eorder information', ship_to='all')
        self.assertIn('all_dist@test.com', emails)
        self.assertIn('dist1@test.com', emails)
        self.assertIn('dist2@test.com', emails)
        self.assertIn('general@test.com', emails)
        self.assertNotIn('inactive@test.com', emails)

    def test_get_cc_emails_payload_ship_to_all_uppercase(self):
        from core.email_service import _get_cc_emails_for_subject
        emails = _get_cc_emails_for_subject('eorder information', ship_to='ALL')
        self.assertIn('all_dist@test.com', emails)
        self.assertIn('dist1@test.com', emails)
        self.assertIn('dist2@test.com', emails)
        self.assertIn('general@test.com', emails)
        self.assertNotIn('inactive@test.com', emails)

    def test_import_csv_multiple_emails(self):
        from rest_framework.test import APIClient
        from django.core.files.uploadedfile import SimpleUploadedFile
        from core.models import CCEmailConfig

        client = APIClient()
        user = User.objects.create_user(username='admin_test', password='password', is_staff=True, is_superuser=True)
        client.force_authenticate(user=user)

        csv_content = (
            "Ship_To,email\n"
            "0001001234,\"user1@test.com, user2@test.com\"\n"
            "0001005678,user3@test.com; user4@test.com\n"
        ).encode('utf-8')

        file = SimpleUploadedFile("test_import.csv", csv_content, content_type="text/csv")
        response = client.post('/api/v1/admin/cc-email-configs/import-csv/', {'file': file}, format='multipart')

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.get('success'))
        self.assertEqual(response.data.get('created_count'), 4)

        self.assertTrue(CCEmailConfig.objects.filter(ship_to='0001001234', email='user1@test.com').exists())
        self.assertTrue(CCEmailConfig.objects.filter(ship_to='0001001234', email='user2@test.com').exists())
        self.assertTrue(CCEmailConfig.objects.filter(ship_to='0001005678', email='user3@test.com').exists())
        self.assertTrue(CCEmailConfig.objects.filter(ship_to='0001005678', email='user4@test.com').exists())



