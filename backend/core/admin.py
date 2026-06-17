"""
Core Django Admin Configuration
================================
Registers all models with the Django admin for easy data management.
"""
from django.contrib import admin
from core.models import (
    Module, Role, User, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog, Division, Brand, UserBrand, MasterWorkflowCriteria, ModuleVariable,
    UserRole
)


@admin.register(Division)
class DivisionAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'created_at']
    search_fields = ['name', 'code']


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'owner', 'master_workflow_condition', 'created_at']
    search_fields = ['name', 'code', 'owner__username', 'master_workflow_condition__name']
    list_filter = ['owner']

@admin.register(MasterWorkflowCriteria)
class MasterWorkflowCriteriaAdmin(admin.ModelAdmin):
    list_display = ['name', 'description', 'key_param_json', 'created_at']
    search_fields = ['name']
    list_filter = ['name']

@admin.register(ModuleVariable)
class ModuleVariableAdmin(admin.ModelAdmin):
    list_display = ['name', 'module', 'key_name', 'data_type', 'is_active']
    search_fields = ['name', 'key_name']
    list_filter = ['module', 'data_type', 'is_active']

@admin.register(UserBrand)
class UserBrandAdmin(admin.ModelAdmin):
    list_display = ['user', 'brand']
    list_filter = ['user', 'brand']
    search_fields = ['user__username', 'brand__name']


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code']


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'created_at']
    list_filter = []
    search_fields = ['name', 'code']


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 1

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'division', 'department', 'is_approver', 'is_active', 'roles']
    list_filter = ['division', 'is_approver', 'is_active', 'user_roles__role']
    search_fields = ['username', 'email', 'first_name', 'last_name']
    inlines = [UserRoleInline]

    def roles(self, obj):
        return ", ".join([ur.role.name for ur in obj.user_roles.all()])
    roles.short_description = 'Roles'


class WorkflowStepDefinitionInline(admin.TabularInline):
    model = WorkflowStepDefinition
    extra = 1
    ordering = ['step_order']


@admin.register(WorkflowDefinition)
class WorkflowDefinitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'module', 'total_steps', 'is_active', 'created_at']
    list_filter = ['module', 'is_active']
    search_fields = ['name']
    inlines = [WorkflowStepDefinitionInline]


class ApprovalStepInline(admin.TabularInline):
    model = ApprovalStep
    extra = 0
    readonly_fields = ['acted_at']
    ordering = ['step_order']


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'division', 'status', 'priority', 'requester', 'current_step', 'created_at']
    list_filter = ['module', 'division', 'status', 'priority']
    search_fields = ['title', 'reference_id']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ApprovalStepInline]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['request', 'actor', 'action', 'timestamp', 'ip_address']
    list_filter = ['action']
    search_fields = ['details']
    readonly_fields = ['request', 'step', 'actor', 'action', 'details', 'ip_address', 'payload_snapshot', 'timestamp']
