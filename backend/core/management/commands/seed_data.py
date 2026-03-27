"""
Seed Data Management Command
=============================
Seeds the database with initial data: roles, modules, workflow definitions,
test users, and sample approval requests.
Usage: python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import (
    Role, Module, User, WorkflowDefinition,
    WorkflowStepDefinition, ApprovalRequest, ApprovalStep, AuditLog
)
from core.engine import WorkflowEngine


class Command(BaseCommand):
    help = 'Seed the database with initial data for development and testing.'

    def handle(self, *args, **options):
        self.stdout.write('🌱 Seeding database...\n')

        # ─── Roles ─────────────────────────────
        roles_data = [
            {'name': 'Staff', 'code': 'STAFF', 'description': 'Regular employee'},
            {'name': 'Supervisor', 'code': 'SPV', 'description': 'Team supervisor'},
            {'name': 'Manager', 'code': 'MGR', 'description': 'Department manager'},
            {'name': 'Director', 'code': 'DIR', 'description': 'Company director'},
            {'name': 'Finance Head', 'code': 'FIN_HEAD', 'description': 'Head of Finance'},
            {'name': 'HR Head', 'code': 'HR_HEAD', 'description': 'Head of Human Resources'},
            {'name': 'Admin', 'code': 'ADMIN', 'description': 'System administrator'},
        ]
        roles = {}
        for rd in roles_data:
            role, created = Role.objects.get_or_create(
                code=rd['code'],
                defaults=rd
            )
            roles[rd['code']] = role
            status_icon = '✅' if created else '⏭️ '
            self.stdout.write(f"  {status_icon} Role: {role.name}")

        # ─── Modules ──────────────────────────
        modules_data = [
            {
                'name': 'E-Order',
                'code': 'EORDER',
                'description': 'Electronic ordering system for purchase orders',
                'icon': 'shopping-cart',
                'color': '#3B82F6',
            },
            {
                'name': 'Finance',
                'code': 'FINANCE',
                'description': 'Financial operations: budgets, expenses, invoices',
                'icon': 'wallet',
                'color': '#10B981',
            },
            {
                'name': 'HR',
                'code': 'HR',
                'description': 'Human resources: leave, onboarding, evaluations',
                'icon': 'users',
                'color': '#8B5CF6',
            },
        ]
        modules = {}
        for md in modules_data:
            module, created = Module.objects.get_or_create(
                code=md['code'],
                defaults=md
            )
            modules[md['code']] = module
            status_icon = '✅' if created else '⏭️ '
            self.stdout.write(f"  {status_icon} Module: {module.name}")

        # ─── Users ──────────────────────────────
        users_data = [
            {
                'username': 'admin',
                'email': 'admin@company.com',
                'first_name': 'System',
                'last_name': 'Admin',
                'role_code': 'ADMIN',
                'department': 'IT',
                'is_approver': True,
                'is_staff': True,
                'is_superuser': True,
            },
            {
                'username': 'john.staff',
                'email': 'john@company.com',
                'first_name': 'John',
                'last_name': 'Smith',
                'role_code': 'STAFF',
                'department': 'Procurement',
                'is_approver': False,
            },
            {
                'username': 'jane.spv',
                'email': 'jane@company.com',
                'first_name': 'Jane',
                'last_name': 'Wilson',
                'role_code': 'SPV',
                'department': 'Procurement',
                'is_approver': True,
            },
            {
                'username': 'bob.mgr',
                'email': 'bob@company.com',
                'first_name': 'Bob',
                'last_name': 'Manager',
                'role_code': 'MGR',
                'department': 'Operations',
                'is_approver': True,
            },
            {
                'username': 'alice.dir',
                'email': 'alice@company.com',
                'first_name': 'Alice',
                'last_name': 'Director',
                'role_code': 'DIR',
                'department': 'Executive',
                'is_approver': True,
            },
            {
                'username': 'charlie.fin',
                'email': 'charlie@company.com',
                'first_name': 'Charlie',
                'last_name': 'Finance',
                'role_code': 'FIN_HEAD',
                'department': 'Finance',
                'is_approver': True,
            },
            {
                'username': 'diana.hr',
                'email': 'diana@company.com',
                'first_name': 'Diana',
                'last_name': 'HR',
                'role_code': 'HR_HEAD',
                'department': 'Human Resources',
                'is_approver': True,
            },
        ]

        users = {}
        for ud in users_data:
            role_code = ud.pop('role_code')
            user, created = User.objects.get_or_create(
                username=ud['username'],
                defaults={
                    'email': ud['email'],
                    'first_name': ud['first_name'],
                    'last_name': ud['last_name'],
                    'role': roles[role_code],
                    'department': ud.get('department', ''),
                    'is_approver': ud.get('is_approver', False),
                    'is_staff': ud.get('is_staff', False),
                    'is_superuser': ud.get('is_superuser', False),
                }
            )
            if created:
                user.set_password('password123')
                user.save()
                self.stdout.write(f"  ✅ User: {user.username} (password: password123)")
            else:
                # Update existing user attributes
                user.email = ud['email']
                user.first_name = ud['first_name']
                user.last_name = ud['last_name']
                user.role = roles[role_code]
                user.department = ud.get('department', '')
                user.is_approver = ud.get('is_approver', False)
                user.is_staff = ud.get('is_staff', False)
                user.is_superuser = ud.get('is_superuser', False)
                user.save()
                self.stdout.write(f"  ⏭️  User: {user.username} (updated)")
            users[ud['username']] = user

        # ─── Workflow Definitions ─────────────
        self.stdout.write('\n📋 Creating workflow definitions...')

        # E-Order: 3-level approval (SPV → MGR → DIR)
        wf_eorder, created = WorkflowDefinition.objects.get_or_create(
            module=modules['EORDER'],
            name='Purchase Order Approval',
            defaults={
                'description': '3-level approval for purchase orders: Supervisor → Manager → Director',
                'total_steps': 3,
            }
        )
        if created:
            WorkflowStepDefinition.objects.create(
                workflow=wf_eorder, step_order=1,
                name='Supervisor Review', role_required=roles['SPV']
            )
            WorkflowStepDefinition.objects.create(
                workflow=wf_eorder, step_order=2,
                name='Manager Approval', role_required=roles['MGR']
            )
            WorkflowStepDefinition.objects.create(
                workflow=wf_eorder, step_order=3,
                name='Director Final Approval', role_required=roles['DIR']
            )
            self.stdout.write('  ✅ E-Order: Purchase Order Approval (3 steps)')

        # Finance: 2-level approval (FIN_HEAD → DIR)
        wf_finance, created = WorkflowDefinition.objects.get_or_create(
            module=modules['FINANCE'],
            name='Expense Claim Approval',
            defaults={
                'description': '2-level approval for expense claims: Finance Head → Director',
                'total_steps': 2,
            }
        )
        if created:
            WorkflowStepDefinition.objects.create(
                workflow=wf_finance, step_order=1,
                name='Finance Head Review', role_required=roles['FIN_HEAD']
            )
            WorkflowStepDefinition.objects.create(
                workflow=wf_finance, step_order=2,
                name='Director Approval', role_required=roles['DIR']
            )
            self.stdout.write('  ✅ Finance: Expense Claim Approval (2 steps)')

        # HR: 2-level approval (HR_HEAD → DIR)
        wf_hr, created = WorkflowDefinition.objects.get_or_create(
            module=modules['HR'],
            name='Leave Request Approval',
            defaults={
                'description': '2-level approval for leave requests: HR Head → Director',
                'total_steps': 2,
            }
        )
        if created:
            WorkflowStepDefinition.objects.create(
                workflow=wf_hr, step_order=1,
                name='HR Head Review', role_required=roles['HR_HEAD']
            )
            WorkflowStepDefinition.objects.create(
                workflow=wf_hr, step_order=2,
                name='Director Approval', role_required=roles['DIR']
            )
            self.stdout.write('  ✅ HR: Leave Request Approval (2 steps)')

        # ─── Sample Approval Requests ─────────
        self.stdout.write('\n📝 Creating sample approval requests...')
        requester = users.get('john.staff')
        if requester and not ApprovalRequest.objects.exists():
            # E-Order sample
            WorkflowEngine.submit_request(
                module_code='EORDER',
                workflow_id=wf_eorder.id,
                requester=requester,
                title='PO-2026-001: Raw Materials Purchase',
                payload={
                    'type': 'purchase_order',
                    'po_number': 'PO-2026-001',
                    'distributor': 'PT Global Supplier',
                    'items': [
                        {'sku': 'RM-001', 'name': 'Steel Plate A4', 'qty': 100, 'price': 50000},
                        {'sku': 'RM-002', 'name': 'Aluminum Rod B2', 'qty': 50, 'price': 75000},
                    ],
                    'total_amount': 8750000,
                    'currency': 'IDR',
                    'delivery_date': '2026-04-15',
                },
                priority='HIGH',
                reference_id='PO-2026-001',
            )
            self.stdout.write('  ✅ Sample E-Order request created')

            # Finance sample
            WorkflowEngine.submit_request(
                module_code='FINANCE',
                workflow_id=wf_finance.id,
                requester=requester,
                title='Expense: Business Trip to Surabaya',
                payload={
                    'type': 'expense_claim',
                    'description': 'Business trip to Surabaya for client meeting',
                    'amount': 3500000,
                    'currency': 'IDR',
                    'category': 'Travel',
                    'date_incurred': '2026-03-20',
                    'receipts': ['receipt_hotel.pdf', 'receipt_flight.pdf'],
                },
                priority='MEDIUM',
            )
            self.stdout.write('  ✅ Sample Finance request created')

            # HR sample
            WorkflowEngine.submit_request(
                module_code='HR',
                workflow_id=wf_hr.id,
                requester=requester,
                title='Annual Leave Request - 5 Days',
                payload={
                    'type': 'leave_request',
                    'leave_type': 'Annual Leave',
                    'start_date': '2026-04-01',
                    'end_date': '2026-04-07',
                    'days': 5,
                    'reason': 'Family vacation',
                    'delegate_to': 'jane.spv',
                },
                priority='LOW',
            )
            self.stdout.write('  ✅ Sample HR request created')

        self.stdout.write(self.style.SUCCESS('\n✨ Database seeded successfully!'))
        self.stdout.write(self.style.WARNING('\n📌 Test credentials:'))
        self.stdout.write('   All users have password: password123')
        self.stdout.write('   Admin: admin | Staff: john.staff | Supervisor: jane.spv')
        self.stdout.write('   Manager: bob.mgr | Director: alice.dir')
        self.stdout.write('   Finance Head: charlie.fin | HR Head: diana.hr')
