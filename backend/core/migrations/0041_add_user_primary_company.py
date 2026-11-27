from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_add_step_lock_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='primary_company',
            field=models.ForeignKey(
                blank=True,
                help_text='Default/fallback company when user is not yet mapped in OrganizationStructure',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='primary_users',
                to='core.company',
            ),
        ),
    ]

