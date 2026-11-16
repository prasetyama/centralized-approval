from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0039_add_adhoc_user_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='approvalstep',
            name='locked_by',
            field=models.ForeignKey(
                blank=True,
                help_text='User currently holding the lease lock on this step',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='locked_approval_steps',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='approvalstep',
            name='locked_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='approvalstep',
            name='lock_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

