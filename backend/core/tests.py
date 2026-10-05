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
    ApprovalStep
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



