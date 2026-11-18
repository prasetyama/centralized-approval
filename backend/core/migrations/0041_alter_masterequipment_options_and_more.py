# Generated for UserLeaveDelegation with SeparateDatabaseAndState for legacy master tables

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_add_step_lock_fields'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AlterModelOptions(
                    name='masterequipment',
                    options={'ordering': ['code']},
                ),
                migrations.AlterModelOptions(
                    name='mastergoods',
                    options={'ordering': ['code']},
                ),
                migrations.RenameField(
                    model_name='prnontradeitem',
                    old_name='goods_name',
                    new_name='description',
                ),
                migrations.RemoveField(
                    model_name='masterequipment',
                    name='category',
                ),
                migrations.RemoveField(
                    model_name='masterequipment',
                    name='is_active',
                ),
                migrations.RemoveField(
                    model_name='masterequipment',
                    name='name',
                ),
                migrations.RemoveField(
                    model_name='mastergoods',
                    name='category',
                ),
                migrations.RemoveField(
                    model_name='mastergoods',
                    name='is_active',
                ),
                migrations.RemoveField(
                    model_name='mastergoods',
                    name='name',
                ),
                migrations.AddField(
                    model_name='masterequipment',
                    name='company_id',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='masterequipment',
                    name='description',
                    field=models.TextField(blank=True, default=''),
                ),
                migrations.AddField(
                    model_name='masterequipment',
                    name='plant',
                    field=models.CharField(blank=True, default='', help_text='Plant', max_length=50),
                ),
                migrations.AddField(
                    model_name='mastergoods',
                    name='active_status',
                    field=models.CharField(blank=True, max_length=5, null=True),
                ),
                migrations.AddField(
                    model_name='mastergoods',
                    name='company_id',
                    field=models.IntegerField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='mastergoods',
                    name='description',
                    field=models.TextField(blank=True, default=''),
                ),
                migrations.AddField(
                    model_name='mastergoods',
                    name='dtfractstatus',
                    field=models.CharField(blank=True, max_length=25, null=True),
                ),
                migrations.AddField(
                    model_name='mastergoods',
                    name='plant',
                    field=models.CharField(blank=True, max_length=10, null=True),
                ),
                migrations.AddField(
                    model_name='mastergoods',
                    name='sloc',
                    field=models.CharField(blank=True, max_length=10, null=True),
                ),
                migrations.AlterField(
                    model_name='masterequipment',
                    name='created_at',
                    field=models.DateTimeField(auto_now_add=True, null=True),
                ),
                migrations.AlterField(
                    model_name='mastergoods',
                    name='created_at',
                    field=models.DateTimeField(auto_now_add=True, null=True),
                ),
            ],
            database_operations=[]
        ),
        migrations.CreateModel(
            name='UserLeaveDelegation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_date', models.DateTimeField(db_index=True, help_text='Start date & time of the leave / delegation period')),
                ('end_date', models.DateTimeField(db_index=True, help_text='End date & time of the leave / delegation period')),
                ('reason', models.CharField(blank=True, default='Cuti / Out of Office', help_text='Reason for leave or delegation (e.g. Cuti Tahunan, Ibadah, Sakit, Dinas)', max_length=255)),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Toggle to manually activate/deactivate this delegation')),
                ('scope', models.CharField(choices=[('ALL', 'Semua Pengajuan (Global)'), ('SPECIFIC_MODULE', 'Modul Tertentu Saja')], default='ALL', help_text='Module scope for this delegation', max_length=30)),
                ('specific_module_codes', models.JSONField(blank=True, default=list, help_text="List of module codes if scope=SPECIFIC_MODULE (e.g. ['EORDER', 'PR_NON_TRADE'])")),
                ('notify_delegate', models.BooleanField(default=True, help_text='Send email notification to delegate user when created')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_leave_delegations', to=settings.AUTH_USER_MODEL)),
                ('delegate_user', models.ForeignKey(help_text='Substitute user who receives approval authority', on_delete=django.db.models.deletion.CASCADE, related_name='leave_delegations_received', to=settings.AUTH_USER_MODEL)),
                ('user', models.ForeignKey(help_text='User/approver who is taking leave', on_delete=django.db.models.deletion.CASCADE, related_name='leave_delegations_given', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'aw_user_leave_delegation',
                'ordering': ['-start_date'],
                'indexes': [models.Index(fields=['user', 'is_active', 'start_date', 'end_date'], name='idx_deleg_u_act_dates'), models.Index(fields=['delegate_user', 'is_active', 'start_date', 'end_date'], name='idx_deleg_d_act_dates')],
            },
        ),
    ]
