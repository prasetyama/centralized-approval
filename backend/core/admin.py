"""
Core Django Admin Configuration
================================
Registers all models with the Django admin for easy data management.
"""
from django.contrib import admin
from core.models import (
    Module, Role, User, WorkflowDefinition, WorkflowStepDefinition,
    ApprovalRequest, ApprovalStep, AuditLog
)


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


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ['username', 'email', 'role', 'department', 'is_approver', 'is_active']
    list_filter = ['role', 'is_approver', 'is_active']
    search_fields = ['username', 'email', 'first_name', 'last_name']


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
    list_display = ['title', 'module', 'status', 'priority', 'requester', 'current_step', 'created_at']
    list_filter = ['module', 'status', 'priority']
    search_fields = ['title', 'reference_id']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [ApprovalStepInline]


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['request', 'actor', 'action', 'timestamp', 'ip_address']
    list_filter = ['action']
    search_fields = ['details']
    readonly_fields = ['request', 'step', 'actor', 'action', 'details', 'ip_address', 'payload_snapshot', 'timestamp']
