"""
Core Serializers
================
DRF serializers for all core models.
"""
from rest_framework import serializers
from core.models import (
    Module, Role, User, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog
)


class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for list views."""
    role_name = serializers.CharField(source='role.name', read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_name', 'department', 'is_approver', 'is_active',
        ]


class UserDetailSerializer(serializers.ModelSerializer):
    """Full user serializer for detail/create/update views."""
    role_name = serializers.CharField(source='role.name', read_only=True, default=None)
    role_code = serializers.CharField(source='role.code', read_only=True, default=None)
    password = serializers.CharField(write_only=True, required=False, min_length=6)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_name', 'role_code', 'department', 'phone',
            'is_approver', 'is_active', 'password', 'date_joined',
        ]
        read_only_fields = ['date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class ModuleSerializer(serializers.ModelSerializer):
    """Serializer for Module model."""
    class Meta:
        model = Module
        fields = ['id', 'name', 'code', 'description', 'is_active', 'icon', 'color', 'created_at']
        read_only_fields = ['created_at']


class WorkflowStepDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowStepDefinition."""
    role_name = serializers.CharField(source='role_required.name', read_only=True)

    class Meta:
        model = WorkflowStepDefinition
        fields = ['id', 'step_order', 'name', 'role_required', 'role_name', 'is_optional']


class WorkflowDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowDefinition with nested steps."""
    steps = WorkflowStepDefinitionSerializer(many=True, read_only=True)
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)

    class Meta:
        model = WorkflowDefinition
        fields = [
            'id', 'module', 'module_name', 'module_code', 'name',
            'description', 'total_steps', 'is_active', 'steps',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class WorkflowDefinitionWriteSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating WorkflowDefinition with nested steps."""
    steps = WorkflowStepDefinitionSerializer(many=True)

    class Meta:
        model = WorkflowDefinition
        fields = ['id', 'module', 'name', 'description', 'total_steps', 'is_active', 'steps']

    def create(self, validated_data):
        steps_data = validated_data.pop('steps')
        validated_data['total_steps'] = len(steps_data)
        workflow = WorkflowDefinition.objects.create(**validated_data)
        for step_data in steps_data:
            WorkflowStepDefinition.objects.create(workflow=workflow, **step_data)
        return workflow

    def update(self, instance, validated_data):
        steps_data = validated_data.pop('steps', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if steps_data is not None:
            instance.total_steps = len(steps_data)
            instance.steps.all().delete()
            for step_data in steps_data:
                WorkflowStepDefinition.objects.create(workflow=instance, **step_data)
        instance.save()
        return instance


class ApprovalStepSerializer(serializers.ModelSerializer):
    """Serializer for ApprovalStep instances."""
    assigned_to_name = serializers.SerializerMethodField()
    role_name = serializers.CharField(source='role_required.name', read_only=True)

    class Meta:
        model = ApprovalStep
        fields = [
            'id', 'step_order', 'name', 'assigned_to', 'assigned_to_name',
            'role_required', 'role_name', 'status', 'comments', 'acted_at',
        ]

    def get_assigned_to_name(self, obj):
        """Get display name for the assigned approver."""
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog entries."""
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'action', 'actor', 'actor_name', 'details',
            'ip_address', 'payload_snapshot', 'timestamp',
        ]

    def get_actor_name(self, obj):
        """Get display name for the actor."""
        return obj.actor.get_full_name() or obj.actor.username


class ApprovalRequestListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing approval requests."""
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_color = serializers.CharField(source='module.color', read_only=True)
    module_icon = serializers.CharField(source='module.icon', read_only=True)
    requester_name = serializers.SerializerMethodField()
    current_step_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'reference_id', 'module', 'module_name', 'module_code',
            'module_color', 'module_icon', 'title', 'status', 'priority',
            'current_step', 'current_step_name', 'requester', 'requester_name',
            'created_at', 'updated_at',
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_current_step_name(self, obj):
        step = obj.steps.filter(step_order=obj.current_step).first()
        return step.name if step else None


class ApprovalRequestDetailSerializer(serializers.ModelSerializer):
    """Full serializer for approval request detail view with steps and audit trail."""
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_color = serializers.CharField(source='module.color', read_only=True)
    module_icon = serializers.CharField(source='module.icon', read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    requester_name = serializers.SerializerMethodField()
    steps = ApprovalStepSerializer(many=True, read_only=True)
    audit_logs = AuditLogSerializer(many=True, read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'reference_id', 'module', 'module_name', 'module_code',
            'module_color', 'module_icon', 'workflow', 'workflow_name',
            'requester', 'requester_name', 'title', 'description',
            'payload', 'status', 'current_step', 'priority',
            'steps', 'audit_logs', 'created_at', 'updated_at',
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username


class SubmitRequestSerializer(serializers.Serializer):
    """Serializer for the submit workflow request endpoint."""
    module_code = serializers.CharField(max_length=50)
    workflow_id = serializers.IntegerField()
    title = serializers.CharField(max_length=300)
    description = serializers.CharField(required=False, default='')
    payload = serializers.JSONField()
    priority = serializers.ChoiceField(
        choices=['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default='MEDIUM'
    )
    reference_id = serializers.CharField(max_length=100, required=False, default='')


class ActionSerializer(serializers.Serializer):
    """Serializer for approve/reject actions."""
    comments = serializers.CharField(required=False, default='', allow_blank=True)
