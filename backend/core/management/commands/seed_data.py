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

        # Clear existing data to avoid conflicts with new schema
        self.stdout.write('🧹 Cleaning existing data...')
        ApprovalStep.objects.all().delete()
        ApprovalRequest.objects.all().delete()
        WorkflowStepDefinition.objects.all().delete()
        WorkflowDefinition.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        Role.objects.all().delete()
        Module.objects.all().delete()

        # ─── Modules ──────────────────────────
        modules_data = [
            {
                'name': 'E-Order',
                'code': 'EORDER',
                'description': 'Electronic ordering system for purchase orders',
                'icon': 'shopping-cart',
                'color': '#3B82F6',
                'notification_strategy': 'WEBHOOK',
                'callback_url': 'http://localhost:3002/api/approvals/callback',
                'db_type': 'mysql',
                'db_host': 'localhost',
                'db_port': 3306,
                'db_user': 'root',
                'db_password': 'root123456%qaz!',
                'db_name': 'eorder',
                'db_table_name': 'eorder_eorderdatadtl',
                'db_flag_column': 'release_flag',
                'db_reference_column': 'reference_od',
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
            self.stdout.write(f"  ✅ Module: {module.name}")

        # ─── Roles (Global) ──────────────────────────
        roles_data = [
            {'code': 'SPV', 'name': 'Supervisor', 'description': 'Supervisor role'},
            {'code': 'MGR', 'name': 'Manager', 'description': 'Manager role'},
            {'code': 'DIR', 'name': 'Director', 'description': 'Director role'},
            {'code': 'FIN_HEAD', 'name': 'Finance Head', 'description': 'Finance Head role'},
            {'code': 'HR_HEAD', 'name': 'HR Head', 'description': 'HR Head role'},
            {'code': 'ADMIN', 'name': 'System Administrator', 'description': 'Full system access'},
        ]
        roles = {}
        for rd in roles_data:
            role = Role.objects.create(**rd)
            roles[rd['code']] = role
            self.stdout.write(f"  ✅ Role: {role.name}")

        # ─── Users ──────────────────────────────
        users_data = [
            {
                'username': 'admin',
                'email': 'admin@company.com',
                'first_name': 'System',
                'last_name': 'Admin',
                'role_key': 'ADMIN',
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
                'role_key': None,
                'department': 'Procurement',
                'is_approver': False,
            },
            {
                'username': 'jane.spv',
                'email': 'jane@company.com',
                'first_name': 'Jane',
                'last_name': 'Wilson',
                'role_key': 'SPV',
                'department': 'Procurement',
                'is_approver': True,
            },
            {
                'username': 'bob.mgr',
                'email': 'bob@company.com',
                'first_name': 'Bob',
                'last_name': 'Manager',
                'role_key': 'MGR',
                'department': 'Operations',
                'is_approver': True,
            },
            {
                'username': 'alice.dir',
                'email': 'alice@company.com',
                'first_name': 'Alice',
                'last_name': 'Director',
                'role_key': 'DIR',
                'department': 'Executive',
                'is_approver': True,
            },
        ]

        # Get or create superuser admin separately to avoid issues
        admin_user = User.objects.filter(username='admin').first()
        if not admin_user:
            admin_user = User.objects.create_superuser('admin', 'admin@company.com', 'password123')
            admin_user.first_name = 'System'
            admin_user.last_name = 'Admin'
            admin_user.save()
        
        users = {'admin': admin_user}

        for ud in users_data:
            if ud['username'] == 'admin':
                user = admin_user
            else:
                user, created = User.objects.get_or_create(
                    username=ud['username'],
                    defaults={
                        'email': ud['email'],
                        'first_name': ud['first_name'],
                        'last_name': ud['last_name'],
                        'department': ud.get('department', ''),
                        'is_approver': ud.get('is_approver', False),
                        'is_staff': ud.get('is_staff', False),
                    }
                )
                if created:
                    user.set_password('password123')
                    user.save()
            
            # Assign single role
            if ud['role_key']:
                user.role = roles.get(ud['role_key'])
                user.save(update_fields=['role'])
            
            self.stdout.write(f"  ✅ User: {user.username} (role: {user.role.code if user.role else 'None'})")
            users[ud['username']] = user

        # ─── Workflow Definitions ─────────────
        self.stdout.write('\n📋 Creating workflow definitions...')

        # E-Order: 3-level approval (SPV → MGR → DIR)
        wf_eorder = WorkflowDefinition.objects.create(
            module=modules['EORDER'],
            name='Purchase Order Approval',
            description='3-level approval for purchase orders: Supervisor → Manager → Director',
            total_steps=3,
        )
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
        wf_finance = WorkflowDefinition.objects.create(
            module=modules['FINANCE'],
            name='Expense Claim Approval',
            description='2-level approval for expense claims: Finance Head → Director',
            total_steps=2,
        )
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
        wf_hr = WorkflowDefinition.objects.create(
            module=modules['HR'],
            name='Leave Request Approval',
            description='2-level approval for leave requests: HR Head → Director',
            total_steps=2,
        )
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
        if requester:
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

        self.stdout.write(self.style.SUCCESS('\n✨ Database seeded successfully!'))
        self.stdout.write(self.style.WARNING('\n📌 Test credentials:'))
        self.stdout.write('   All users have password: password123')
        self.stdout.write('   Admin: admin | Staff: john.staff | Supervisor: jane.spv')
        self.stdout.write('   Manager: bob.mgr | Director: alice.dir')
