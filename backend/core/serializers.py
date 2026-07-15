"""
Core Serializers
================
DRF serializers for all core models.
"""
from rest_framework import serializers
from core.models import (
    Module, Role, User, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, Division, RequestFeedback,
    Brand, UserBrand, MasterWorkflowCriteria, RequestWatcher, ModuleVariable,
    UserRole
)


class DivisionSerializer(serializers.ModelSerializer):
    """Serializer for Division model."""
    class Meta:
        model = Division
        fields = ['id', 'name', 'code', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class BrandSerializer(serializers.ModelSerializer):
    """Serializer for Brand model."""
    owner_name = serializers.CharField(source='owner.username', read_only=True)
    owner_full_name = serializers.SerializerMethodField()
    master_workflow_condition_name = serializers.CharField(source='master_workflow_condition.name', read_only=True)

    class Meta:
        model = Brand
        fields = ['id', 'name', 'code', 'owner', 'owner_name', 'owner_full_name', 'master_workflow_condition', 'master_workflow_condition_name', 'created_at', 'updated_at']

    def get_owner_full_name(self, obj):
        return obj.owner.get_full_name() if obj.owner else None


class UserBrandSerializer(serializers.ModelSerializer):
    """Serializer for UserBrand mapping."""
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_full_name = serializers.SerializerMethodField()
    brand_name = serializers.CharField(source='brand.name', read_only=True)

    class Meta:
        model = UserBrand
        fields = ['id', 'user', 'user_name', 'user_full_name', 'brand', 'brand_name']

    def get_user_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username

class MasterWorkflowCriteriaSerializer(serializers.ModelSerializer):
    """Serializer for MasterWorkflowCriteria mapping."""

    class Meta:
        model = MasterWorkflowCriteria
        fields = ['id', 'name', 'description', 'key_param_json']



class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model."""
    
    class Meta:
        model = Role
        fields = ['id', 'name', 'code', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight user serializer for list views."""
    role = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    role_code = serializers.SerializerMethodField()
    division_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_name', 'role_code', 'division', 'division_name', 'department', 'is_approver', 'is_active',
            'is_superuser', 'is_staff',
        ]

    def get_role(self, obj):
        ur = obj.user_roles.first()
        return ur.role.id if ur and ur.role else None

    def get_role_name(self, obj):
        ur = obj.user_roles.first()
        return ur.role.name if ur and ur.role else None

    def get_role_code(self, obj):
        ur = obj.user_roles.first()
        return ur.role.code if ur and ur.role else None

    def get_division_name(self, obj):
        """Look up division name by its code string."""
        if obj.division:
            try:
                return Division.objects.get(code=obj.division).name
            except Division.DoesNotExist:
                return obj.division
        return None


class UserDetailSerializer(serializers.ModelSerializer):
    """Full user serializer for detail/create/update views."""
    role = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    role_details = serializers.SerializerMethodField()
    division_details = serializers.SerializerMethodField()
    role_name = serializers.SerializerMethodField()
    role_code = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, min_length=6)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_name', 'role_code', 'role_details', 'roles', 'division', 'division_details', 'department', 'phone',
            'is_approver', 'is_active', 'is_superuser', 'is_staff', 'password', 'date_joined',
        ]
        read_only_fields = ['date_joined']

    def get_role_details(self, obj):
        ur = obj.user_roles.first()
        return RoleSerializer(ur.role).data if ur and ur.role else None

    def get_role_name(self, obj):
        ur = obj.user_roles.first()
        return ur.role.name if ur and ur.role else None

    def get_role_code(self, obj):
        ur = obj.user_roles.first()
        return ur.role.code if ur and ur.role else None

    def get_roles(self, obj):
        return [
            {
                "id": ur.role.id,
                "name": ur.role.name,
                "code": ur.role.code
            }
            for ur in obj.user_roles.all()
        ]

    def get_division_details(self, obj):
        """Look up full division details by its code string."""
        if obj.division:
            try:
                div = Division.objects.get(code=obj.division)
                return DivisionSerializer(div).data
            except Division.DoesNotExist:
                return {"code": obj.division, "name": obj.division}
        return None

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        role_id = validated_data.pop('role', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        
        if role_id:
            try:
                role = Role.objects.get(id=role_id)
                UserRole.objects.create(user=user, role=role, dept=user.department)
            except Role.DoesNotExist:
                pass
                
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        role_id = validated_data.pop('role', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        
        if role_id is not None:
            try:
                role = Role.objects.get(id=role_id)
                # For backwards compatibility with single role expectation, 
                # we clear old roles and set the new one
                instance.user_roles.all().delete()
                UserRole.objects.create(user=instance, role=role, dept=instance.department)
            except Role.DoesNotExist:
                pass

        return instance


class ModuleSerializer(serializers.ModelSerializer):
    """Serializer for Module model."""
    class Meta:
        model = Module
        fields = ['id', 'name', 'code', 'description', 'is_active', 'icon', 'color', 'created_at']
        read_only_fields = ['created_at']


class ModuleVariableSerializer(serializers.ModelSerializer):
    """Serializer for ModuleVariable model."""
    module_name = serializers.SerializerMethodField()
    class Meta:
        model = ModuleVariable
        fields = ['id', 'module', 'name', 'key_name', 'data_type', 'is_active', 'module_name']

    def get_module_name(self, obj):
        return obj.module.name if obj.module else None


class WorkflowStepDefinitionSerializer(serializers.ModelSerializer):
    """Serializer for WorkflowStepDefinition."""
    role_name = serializers.CharField(source='role_required.name', read_only=True)
    user_name = serializers.SerializerMethodField()
    role_users = serializers.SerializerMethodField()
    master_workflow_criteria_key_param_json = serializers.CharField(source='master_workflow_criteria.key_param_json', read_only=True)

    class Meta:
        model = WorkflowStepDefinition
        fields = [
            'id', 'step_order', 'name', 'approver_type', 
            'role_required', 'role_name', 'user_required', 'user_name', 
            'is_brand_conditional', 'master_workflow_criteria', 'master_workflow_criteria_key_param_json', 
            'is_optional', 'conditions', 'role_users'
        ]

    def get_user_name(self, obj):
        if obj.user_required:
            return obj.user_required.get_full_name() or obj.user_required.username
        return None

    def get_role_users(self, obj):
        if obj.approver_type == 'ROLE' and obj.role_required:
            users = User.objects.filter(user_roles__role=obj.role_required, is_active=True)
            return [
                {
                    "id": user.id,
                    "name": user.get_full_name() or user.username,
                    "department": user.department,
                    "division": user.division,
                }
                for user in users
            ]
        return []


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
    assigned_to_email = serializers.CharField(source='assigned_to.email', read_only=True)
    role_name = serializers.CharField(source='role_required.name', read_only=True)
    user_required_name = serializers.SerializerMethodField()
    user_required_email = serializers.CharField(source='user_required.email', read_only=True)
 
    class Meta:
        model = ApprovalStep
        fields = [
            'id', 'step_order', 'name', 'approver_type', 'assigned_to', 'assigned_to_name', 'assigned_to_email',
            'role_required', 'role_name', 'user_required', 'user_required_name', 'user_required_email',
            'status', 'comments', 'acted_at',
        ]
 
    def get_assigned_to_name(self, obj):
        """Get display name for the assigned approver."""
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_user_required_name(self, obj):
        if obj.user_required:
            return obj.user_required.get_full_name() or obj.user_required.username
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


class RequestWatcherSerializer(serializers.ModelSerializer):
    """Serializer for RequestWatcher model."""
    user_name = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = RequestWatcher
        fields = ['id', 'user', 'user_name', 'user_email', 'user_full_name', 'created_at']

    def get_user_full_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


class RequestFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for RequestFeedback model."""
    user_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = RequestFeedback
        fields = ['id', 'request', 'user', 'user_name', 'created_by', 'created_by_name', 'content', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return "Unknown"


class ApprovalRequestListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing approval requests."""
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_color = serializers.CharField(source='module.color', read_only=True)
    module_icon = serializers.CharField(source='module.icon', read_only=True)
    requester_name = serializers.SerializerMethodField()
    division_name = serializers.CharField(source='division.name', read_only=True)
    current_step_name = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'reference_id', 'module', 'module_name', 'module_code',
            'module_color', 'module_icon', 'title', 'status', 'priority',
            'current_step', 'current_step_name', 'requester', 'requester_name',
            'division', 'division_name', 'created_at', 'updated_at',
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_current_step_name(self, obj):
        step = obj.steps.filter(step_order=obj.current_step).first()
        return step.name if step else None

    def get_division_name(self, obj):
        """Look up division name by its code."""
        if obj.division:
            try:
                return Division.objects.get(code=obj.division).name
            except Division.DoesNotExist:
                return obj.division # Fallback to code if name not found
        return None


class ApprovalRequestDetailSerializer(serializers.ModelSerializer):
    """Full serializer for approval request detail view with steps and audit trail."""
    module_name = serializers.CharField(source='module.name', read_only=True)
    module_code = serializers.CharField(source='module.code', read_only=True)
    module_color = serializers.CharField(source='module.color', read_only=True)
    module_icon = serializers.CharField(source='module.icon', read_only=True)
    workflow_name = serializers.CharField(source='workflow.name', read_only=True)
    requester_name = serializers.SerializerMethodField()
    steps = ApprovalStepSerializer(many=True, read_only=True)
    division_details = serializers.SerializerMethodField()
    audit_logs = AuditLogSerializer(many=True, read_only=True)
    feedbacks = RequestFeedbackSerializer(many=True, read_only=True)
    watchers = RequestWatcherSerializer(many=True, read_only=True)

    class Meta:
        model = ApprovalRequest
        fields = [
            'id', 'reference_id', 'module', 'module_name', 'module_code',
            'module_color', 'module_icon', 'workflow', 'workflow_name',
            'requester', 'requester_name', 'title', 'description',
            'payload', 'status', 'current_step', 'priority', 'division', 'division_details',
            'steps', 'audit_logs', 'feedbacks', 'watchers', 'created_at', 'updated_at',
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_division_details(self, obj):
        """Look up full division details by its code."""
        if obj.division:
            try:
                div = Division.objects.get(code=obj.division)
                return DivisionSerializer(div).data
            except Division.DoesNotExist:
                return {"code": obj.division, "name": obj.division}
        return None


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
    division_id = serializers.CharField(max_length=50, required=False, allow_null=True)
    reference_id = serializers.CharField(max_length=100, required=False, default='')
    watcher_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="List of user IDs to be added as watchers"
    )


class ActionSerializer(serializers.Serializer):
    """Serializer for approve/reject actions."""
    comments = serializers.CharField(required=False, default='', allow_blank=True)


class DelegateRequestSerializer(serializers.Serializer):
    """Serializer for the delegate step endpoint."""
    new_assignee_id = serializers.IntegerField()
    comments = serializers.CharField(required=False, default='', allow_blank=True)
