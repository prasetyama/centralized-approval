from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0037_add_sit_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='approvalrequest',
            name='is_test',
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text='True if this approval request was created by a SIT testing user',
            ),
        ),
        migrations.AddField(
            model_name='prnontrade',
            name='is_test',
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text='True if this PR Non-Trade record was created by a SIT testing user',
            ),
        ),
    ]
