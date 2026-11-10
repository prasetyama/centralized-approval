from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0037_add_adhoc_approval_fields'),
        ('core', '0038_approvalrequest_is_test_prnontrade_is_test'),
    ]

    operations = [
        migrations.AddField(
            model_name='workflowstepdefinition',
            name='adhoc_user',
            field=models.ForeignKey(
                blank=True,
                help_text='Predetermined user for optional ad-hoc approval configured in Admin Workflow',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='adhoc_step_definitions',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='approvalstep',
            name='adhoc_user',
            field=models.ForeignKey(
                blank=True,
                help_text='Predetermined ad-hoc approver copied from step definition',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='adhoc_approval_steps',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
