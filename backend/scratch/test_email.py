import os
import sys
import django

# Setup django environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("Email Settings:")
print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
print(f"EMAIL_USE_SSL: {settings.EMAIL_USE_SSL}")
print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")

try:
    print("Testing connection / sending email...")
    send_mail(
        subject="Test SMTP Settings",
        message="This is a test email to verify the SMTP TLS/SSL settings configuration.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=["prasetyama.hidayat@nirwanalestari.com"],
        fail_silently=False,
    )
    print("Email sent successfully!")
except Exception as e:
    print(f"Error sending email: {e}")
