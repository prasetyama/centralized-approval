import logging
from django.core.management.base import BaseCommand
from django.db import connection

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Fixes illegal mix of collations by standardizing all core tables to the database default collation.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting collation standardization..."))

        # Target tables that are commonly involved in JOINs
        target_tables = [
            'aw_user',
            'aw_role',
            'user_title_matrix',
            'aw_approval_request',
            'aw_approval_step',
            'aw_workflow_definition',
            'aw_workflow_step_definition',
            'aw_brand',
            'aw_division',
            'aw_module',
            'aw_master_workflow_condition'
        ]

        with connection.cursor() as cursor:
            # 1. Get the default database collation
            cursor.execute("SELECT @@collation_database;")
            db_collation = cursor.fetchone()[0]
            
            # Extract charset from collation (e.g., utf8mb4_0900_ai_ci -> utf8mb4)
            charset = db_collation.split('_')[0]
            
            self.stdout.write(self.style.SUCCESS(f"Detected Database Default Collation: {db_collation} (Charset: {charset})"))

            for table in target_tables:
                try:
                    self.stdout.write(f"Converting table {table} to {db_collation}...")
                    # This command converts the table's default character set AND all character columns
                    query = f"ALTER TABLE {table} CONVERT TO CHARACTER SET {charset} COLLATE {db_collation};"
                    cursor.execute(query)
                    self.stdout.write(self.style.SUCCESS(f"Successfully converted {table}."))
                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Failed to convert {table}: {str(e)}"))
                    # If table doesn't exist, just skip
                    pass

        self.stdout.write(self.style.SUCCESS("Collation standardization completed!"))
