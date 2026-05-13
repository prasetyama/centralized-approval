from django.core.management.base import BaseCommand
from core.models import Module, ModuleVariable

class Command(BaseCommand):
    help = 'Seed standard variables for HR, Finance, and E-Order modules'

    def handle(self, *args, **options):
        # 1. E-Order
        try:
            eorder = Module.objects.get(code='EORDER')
            self._seed_vars(eorder, [
                ('Total Price', 'total_price', ModuleVariable.DataType.NUMBER),
                ('Total Quantity', 'total_qty', ModuleVariable.DataType.NUMBER),
                ('Category', 'category', ModuleVariable.DataType.STRING),
                ('Is Urgency', 'is_urgent', ModuleVariable.DataType.BOOLEAN),
            ])
            self.stdout.write(self.style.SUCCESS('Successfully seeded E-Order variables'))
        except Module.DoesNotExist:
            self.stdout.write(self.style.WARNING('EORDER module not found, skipping.'))

        # 2. HR
        try:
            hr = Module.objects.get(code='HR')
            self._seed_vars(hr, [
                ('Leave Days', 'leave_days', ModuleVariable.DataType.NUMBER),
                ('Leave Type', 'leave_type', ModuleVariable.DataType.STRING),
                ('Is Unpaid', 'is_unpaid', ModuleVariable.DataType.BOOLEAN),
            ])
            self.stdout.write(self.style.SUCCESS('Successfully seeded HR variables'))
        except Module.DoesNotExist:
            self.stdout.write(self.style.WARNING('HR module not found, skipping.'))

        # 3. Finance
        try:
            finance = Module.objects.get(code='FINANCE')
            self._seed_vars(finance, [
                ('Amount', 'amount', ModuleVariable.DataType.NUMBER),
                ('Budget Code', 'budget_code', ModuleVariable.DataType.STRING),
                ('Is Over Budget', 'is_over_budget', ModuleVariable.DataType.BOOLEAN),
            ])
            self.stdout.write(self.style.SUCCESS('Successfully seeded Finance variables'))
        except Module.DoesNotExist:
            self.stdout.write(self.style.WARNING('FINANCE module not found, skipping.'))

    def _seed_vars(self, module, vars_data):
        for name, key, dtype in vars_data:
            ModuleVariable.objects.get_or_create(
                module=module,
                key_name=key,
                defaults={
                    'name': name,
                    'data_type': dtype,
                    'is_active': True
                }
            )
