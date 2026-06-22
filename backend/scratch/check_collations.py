import os
import sys
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

def check_collations():
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT TABLE_NAME, TABLE_COLLATION 
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME IN ('aw_user', 'user_title_matrix', 'aw_role')
        """)
        tables = cursor.fetchall()
        print("TABLE COLLATIONS:")
        for table in tables:
            print(table)

        cursor.execute("""
            SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME IN ('aw_user', 'user_title_matrix', 'aw_role')
              AND COLUMN_NAME IN ('email', 'title', 'code')
        """)
        columns = cursor.fetchall()
        print("\nCOLUMN COLLATIONS:")
        for col in columns:
            print(col)

check_collations()
