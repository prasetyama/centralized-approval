from django.db import migrations


def add_sit_role(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    Role.objects.get_or_create(
        code='SIT',
        defaults={
            'name': 'SIT',
            'description': 'Role untuk user testing (SIT) - pengalihan notifikasi email ke email testing',
        }
    )


def remove_sit_role(apps, schema_editor):
    Role = apps.get_model('core', 'Role')
    Role.objects.filter(code='SIT').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_mastercarnumber_remove_masterasset_is_active_and_more'),
    ]

    operations = [
        migrations.RunPython(add_sit_role, remove_sit_role),
    ]