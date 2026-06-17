import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, UserRole, Role

print("Users:", User.objects.count())
print("UserRoles:", UserRole.objects.count())
print("Roles:", Role.objects.count())

