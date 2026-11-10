from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_mastercarnumber_remove_masterasset_is_active_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='workflowstepdefinition',
            name='allow_adhoc',
            field=models.BooleanField(
                default=False,
                help_text='If true, approver at this step can optionally insert an ad-hoc approval step after this step',
            ),
        ),
        migrations.AddField(
            model_name='approvalstep',
            name='allow_adhoc',
            field=models.BooleanField(
                default=False,
                help_text='If true, approver at this step can optionally insert an ad-hoc approval step after this step',
            ),
        ),
        migrations.AddField(
            model_name='approvalstep',
            name='is_adhoc',
            field=models.BooleanField(
                default=False,
                help_text='True if dynamically inserted as an ad-hoc approval step',
            ),
        ),
        migrations.AddField(
            model_name='approvalstep',
            name='adhoc_created_by',
            field=models.ForeignKey(
                blank=True,
                help_text='Approver who inserted this ad-hoc step',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='created_adhoc_steps',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name='auditlog',
            name='action',
            field=models.CharField(
                choices=[
                    ('SUBMITTED', 'Submitted'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('REVISED', 'Revised'),
                    ('REASSIGNED', 'Reassigned'),
                    ('CANCELLED', 'Cancelled'),
                    ('FEEDBACK', 'Feedback Added'),
                    ('WATCHER_ADDED', 'Watcher Added'),
                    ('WATCHER_REMOVED', 'Watcher Removed'),
                    ('ADHOC_ADDED', 'Ad-Hoc Approver Added'),
                ],
                max_length=50,
            ),
        ),
    ]

