"""
Core Models - Django ORM
========================
Unified database schema for the Centralized Approval Workflow engine.
Includes all models: Module, Role, User, WorkflowDefinition, WorkflowStepDefinition,
ApprovalRequest, ApprovalStep, and AuditLog.
"""
from django.db import models
from django.contrib.auth.models import AbstractUser


class Division(models.Model):
    """
    Subdivisions or Brands.
    Used for contextual approval routing.
    """
    name = models.CharField(max_length=100, unique=True, help_text="Division or Brand name")
    code = models.CharField(max_length=50, unique=True, help_text="Unique code (e.g., 'BRAND_A', 'DIV_IT')")
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_division'
        verbose_name_plural = 'Divisions'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class Role(models.Model):
    """
    User roles for approval routing.
    Examples: Manager, Director, VP, Finance_Head, HR_Head.
    """
    name = models.CharField(max_length=100, unique=True, help_text="Display name of the role")
    code = models.CharField(max_length=50, unique=True, help_text="Unique code identifier (e.g., 'MGR', 'DIR')")
    description = models.TextField(blank=True, default='', help_text="Optional description of this role")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_role'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class User(AbstractUser):
    """
    Extended user model with role assignment and department.
    Extends Django's AbstractUser for compatibility with Django's auth system.
    """

    email = models.EmailField(unique=True)
    division = models.CharField(max_length=50, blank=True, default='')
    department = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')
    is_approver = models.BooleanField(default=False, help_text="Whether this user can approve requests")

    class Meta:
        db_table = 'aw_user'
        ordering = ['username']

    def __str__(self):
        return f"{self.get_full_name() or self.username}"


class UserRole(models.Model):
    """
    Mapping users to roles.
    A user can have multiple roles in the approval system.
    """
    dept = models.CharField(max_length=50, default='')
    role = models.ForeignKey(
        Role,
        to_field='code',
        db_column='title',
        on_delete=models.CASCADE,
        related_name='role_users'
    )
    user = models.ForeignKey(
        User,
        to_field='email',
        db_column='email',
        on_delete=models.CASCADE,
        related_name='user_roles'
    )

    class Meta:
        db_table = 'user_title_matrix'
        unique_together = ['user', 'role']

    def __str__(self):
        return f"{self.user.username} -> {self.role.name}"


class Module(models.Model):
    """
    Registered source modules that can send approval requests.
    Examples: E-Order, Finance, HR.
    """
    name = models.CharField(max_length=100, unique=True, help_text="Module display name")
    code = models.CharField(max_length=50, unique=True, help_text="Unique code (e.g., 'EORDER', 'FINANCE', 'HR')")
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True)
    icon = models.CharField(max_length=50, blank=True, default='package', help_text="Lucide icon name")
    color = models.CharField(max_length=20, blank=True, default='#3B82F6', help_text="Display color hex")
    callback_url = models.URLField(max_length=500, blank=True, null=True, help_text="URL to notify when approval status changes")
    
    # Notification & Sync Strategies
    NOTIFICATION_STRATEGY_CHOICES = [
        ('WEBHOOK', 'Webhook (Direct Callback)'),
        ('DATABASE', 'Direct Database Update'),
        ('POLLING', 'Polling (None)'),
    ]
    notification_strategy = models.CharField(
        max_length=20,
        choices=NOTIFICATION_STRATEGY_CHOICES,
        default='WEBHOOK',
        help_text="Method to notify the external system"
    )

    # Database connection details (for DATABASE strategy)
    db_type = models.CharField(
        max_length=20,
        choices=[('postgresql', 'PostgreSQL'), ('mysql', 'MySQL'), ('mssql', 'MSSQL')],
        default='mysql',
        help_text="External database type"
    )
    db_host = models.CharField(max_length=255, blank=True, null=True)
    db_port = models.IntegerField(blank=True, null=True)
    db_name = models.CharField(max_length=255, blank=True, null=True)
    db_user = models.CharField(max_length=255, blank=True, null=True)
    db_password = models.CharField(max_length=255, blank=True, null=True)
    
    # Update target (for DATABASE strategy)
    db_table_name = models.CharField(max_length=255, blank=True, null=True, help_text="Table to update on approval")
    db_flag_column = models.CharField(max_length=255, blank=True, null=True, help_text="Column to update (e.g., status, release_flag)")
    db_reference_column = models.CharField(max_length=255, blank=True, null=True, help_text="Column to match reference_id (e.g., order_no)")
    
    status_mapping = models.JSONField(
        default=dict,
        blank=True,
        help_text="Optional mapping from internal status to external status (e.g., {'APPROVED': '6'})"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_module'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class ModuleVariable(models.Model):
    """
    Variables available for a module to be used in approval criteria.
    """
    class DataType(models.TextChoices):
        NUMBER = 'NUMBER', 'Number'
        STRING = 'STRING', 'String'
        BOOLEAN = 'BOOLEAN', 'Boolean'

    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='variables'
    )
    name = models.CharField(max_length=100, help_text="Display name (e.g., 'Total Amount')")
    key_name = models.CharField(max_length=100, help_text="Key in JSON payload (e.g., 'total_amount')")
    data_type = models.CharField(
        max_length=20,
        choices=DataType.choices,
        default=DataType.STRING
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_module_variable'
        unique_together = ['module', 'key_name']
        ordering = ['module', 'name']

    def __str__(self):
        return f"{self.module.code} - {self.name} ({self.key_name})"


class WorkflowDefinition(models.Model):
    """
    Template defining the approval workflow for a module.
    Each module can have multiple workflow definitions (e.g., different for PO vs Invoice).
    """
    module = models.ForeignKey(
        Module,
        on_delete=models.CASCADE,
        related_name='workflows',
        help_text="Module this workflow belongs to"
    )
    name = models.CharField(max_length=200, help_text="Workflow name (e.g., 'Purchase Order Approval')")
    description = models.TextField(blank=True, default='')
    total_steps = models.PositiveIntegerField(default=1, help_text="Total number of approval steps")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_workflow_definition'
        ordering = ['module', 'name']
        indexes = [
            models.Index(fields=['module', 'is_active'], name='idx_wfdef_module_active'),
        ]

    def __str__(self):
        return f"{self.module.code} - {self.name}"


class WorkflowStepDefinition(models.Model):
    """
    Each step in a workflow template.
    Defines the order, name, and required role (or specific user) for approval at that step.
    """
    class ApproverType(models.TextChoices):
        ROLE = 'ROLE', 'Role-based'
        USER = 'USER', 'Specific User'

    workflow = models.ForeignKey(
        WorkflowDefinition,
        on_delete=models.CASCADE,
        related_name='steps',
        help_text="Parent workflow definition"
    )
    step_order = models.PositiveIntegerField(help_text="Step sequence number (1-based)")
    name = models.CharField(max_length=200, help_text="Step name (e.g., 'Manager Review')")
    
    approver_type = models.CharField(
        max_length=10,
        choices=ApproverType.choices,
        default=ApproverType.ROLE,
        help_text="Whether to assign by role or a specific user"
    )
    
    role_required = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='step_definitions',
        null=True,
        blank=True,
        help_text="Role required to approve this step (if type is ROLE)"
    )
    user_required = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='step_definitions',
        null=True,
        blank=True,
        help_text="Specific user required to approve this step (if type is USER)"
    )
    is_brand_conditional = models.BooleanField(default=False, help_text="If true, uses Brand-Specific Approval logic")
    master_workflow_criteria = models.ForeignKey(
        'MasterWorkflowCriteria',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='workflow_steps',
        help_text="Criteria to find the brand/owner for conditional approval"
    )
    is_optional = models.BooleanField(default=False, help_text="If true, step can be skipped")
    conditions = models.JSONField(
        default=list, 
        blank=True, 
        help_text="List of conditions to require/skip this step. Example: [{'field': 'total_amount', 'operator': '>', 'value': 1000000}]"
    )

    class Meta:
        db_table = 'aw_workflow_step_definition'
        ordering = ['workflow', 'step_order']
        unique_together = ['workflow', 'step_order']
        indexes = [
            models.Index(fields=['workflow', 'step_order'], name='idx_stepdef_wf_order'),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.approver_type == self.ApproverType.ROLE and not self.role_required:
            raise ValidationError("role_required was not provided for ROLE-based step.")
        if self.approver_type == self.ApproverType.USER and not self.user_required:
            raise ValidationError("user_required was not provided for USER-based step.")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        if self.approver_type == self.ApproverType.ROLE:
            approver = self.role_required.code if self.role_required else "No Role"
        else:
            approver = self.user_required.username if self.user_required else "No User"
        return f"Step {self.step_order}: {self.name} ({approver})"


class ApprovalRequest(models.Model):
    """
    Main transaction: stores payload from sending module.
    This is the central entity that tracks an approval process from submission to completion.
    Uses a state machine pattern for status management.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        REVISED = 'REVISED', 'Revised'

    reference_id = models.CharField(
        max_length=100,
        help_text="External reference ID from the source module"
    )
    module = models.ForeignKey(
        Module,
        on_delete=models.PROTECT,
        related_name='approval_requests'
    )
    workflow = models.ForeignKey(
        WorkflowDefinition,
        on_delete=models.PROTECT,
        related_name='approval_requests'
    )
    requester = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='submitted_requests',
        help_text="User who submitted this request"
    )
    title = models.CharField(max_length=300, help_text="Brief title for the approval request")
    description = models.TextField(blank=True, default='', help_text="Optional description")
    payload = models.JSONField(
        default=dict,
        help_text="JSON payload from the source module containing all relevant data"
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True
    )
    current_step = models.PositiveIntegerField(
        default=1,
        help_text="Current step number in the approval workflow"
    )
    division = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text="Target division/brand code for this request"
    )
    priority = models.CharField(
        max_length=10,
        choices=[('LOW', 'Low'), ('MEDIUM', 'Medium'), ('HIGH', 'High'), ('URGENT', 'Urgent')],
        default='MEDIUM'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_approval_request'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'current_step'], name='idx_req_status_step'),
            models.Index(fields=['module', 'status'], name='idx_req_module_status'),
            models.Index(fields=['requester', 'status'], name='idx_req_requester_status'),
            models.Index(fields=['reference_id', 'module'], name='idx_req_ref_module'),
        ]

    def __str__(self):
        return f"[{self.module.code}] {self.title} - {self.status}"


class RequestWatcher(models.Model):
    """
    Users who are given read-only access to a specific request.
    They can see details, audit logs, and discussions but cannot take action.
    """
    request = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name='watchers'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='watched_requests'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='watchers_created'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='watchers_deleted'
    )

    class Meta:
        db_table = 'aw_request_watcher'
        unique_together = ['request', 'user']
        verbose_name_plural = 'Request Watchers'

    def __str__(self):
        return f"{self.user.username} watching {self.request.title}"


class ApprovalStep(models.Model):
    """
    Instance of a workflow step being executed for a specific request.
    Created when a request is submitted, based on WorkflowStepDefinition.
    """
    class StepStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        WAITING = 'WAITING', 'Waiting for Approval'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        SKIPPED = 'SKIPPED', 'Skipped'
        ADDITIONAL = 'ADDITIONAL', 'Additional Action Required'

    request = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name='steps'
    )
    step_order = models.PositiveIntegerField(help_text="Step sequence number")
    name = models.CharField(max_length=200)
    
    approver_type = models.CharField(
        max_length=10,
        choices=WorkflowStepDefinition.ApproverType.choices,
        default=WorkflowStepDefinition.ApproverType.ROLE,
        help_text="Whether this step was assigned by role or specific user"
    )

    assigned_to = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_steps',
        help_text="User assigned to approve this step"
    )
    role_required = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name='approval_steps',
        null=True,
        blank=True,
        help_text="Role required for this step"
    )
    user_required = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='assigned_user_steps',
        null=True,
        blank=True,
        help_text="Specific user required for this step"
    )
    status = models.CharField(
        max_length=20,
        choices=StepStatus.choices,
        default=StepStatus.PENDING
    )
    comments = models.TextField(blank=True, default='', help_text="Approver comments")
    acted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'aw_approval_step'
        ordering = ['request', 'step_order']
        unique_together = ['request', 'step_order']
        indexes = [
            models.Index(fields=['assigned_to', 'status'], name='idx_step_assignee_status'),
            models.Index(fields=['request', 'step_order'], name='idx_step_req_order'),
        ]

    def __str__(self):
        approver = "Unassigned"
        if self.assigned_to:
            approver = self.assigned_to.username
        elif self.approver_type == WorkflowStepDefinition.ApproverType.ROLE and self.role_required:
            approver = f"Role: {self.role_required.code}"
        elif self.approver_type == WorkflowStepDefinition.ApproverType.USER and self.user_required:
            approver = f"User: {self.user_required.username}"
            
        return f"Step {self.step_order}: {self.name} ({approver}) - {self.status}"


class AuditLog(models.Model):
    """
    Immutable audit trail for all approval actions.
    Records who did what, when, from where, and a snapshot of the payload at that time.
    """
    class Action(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        REVISED = 'REVISED', 'Revised'
        REASSIGNED = 'REASSIGNED', 'Reassigned'
        CANCELLED = 'CANCELLED', 'Cancelled'
        FEEDBACK = 'FEEDBACK', 'Feedback Added'
        WATCHER_ADDED = 'WATCHER_ADDED', 'Watcher Added'
        WATCHER_REMOVED = 'WATCHER_REMOVED', 'Watcher Removed'

    request = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    step = models.ForeignKey(
        ApprovalStep,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    actor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='audit_actions'
    )
    action = models.CharField(max_length=50, choices=Action.choices)
    details = models.TextField(blank=True, default='', help_text="Human-readable action details")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default='')
    payload_snapshot = models.JSONField(
        default=dict,
        help_text="Snapshot of the request payload at this point in time"
    )
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'aw_audit_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['request', 'timestamp'], name='idx_audit_req_time'),
            models.Index(fields=['actor', 'timestamp'], name='idx_audit_actor_time'),
        ]

    def __str__(self):
        return f"[{self.timestamp}] {self.actor} - {self.action} on {self.request}"

class RequestFeedback(models.Model):
    """
    Non-blocking feedback/discussion for an approval request.
    Can be used by SMEs or Observers to provide input without being part of the approval chain.
    """
    request = models.ForeignKey(
        ApprovalRequest,
        on_delete=models.CASCADE,
        related_name='feedbacks',
        help_text="The approval request this feedback belongs to"
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name='feedbacks_targeted',
        null=True,
        blank=True,
        help_text="The user mentioned/targeted in this feedback"
    )
    content = models.TextField(help_text="The feedback content")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='feedbacks_created',
        default=1,
        help_text="The user who created this feedback"
    )

    class Meta:
        db_table = 'aw_request_feedback'
        ordering = ['created_at']

    def __str__(self):
        return f"Feedback by {self.user} on {self.request}"

class MasterWorkflowCriteria(models.Model):
    name = models.CharField(max_length=150, unique=True, help_text="Master Zone, Master Brand")
    description = models.CharField(max_length=255, null=True, blank=True)
    key_param_json = models.CharField(max_length=50, unique=True, help_text="brand_code, zone_code")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'aw_master_workflow_condition'
        ordering = ['name']

    def __str__(self):
        return f"{self.name}"
    


class Brand(models.Model):
    """
    Brand management model.
    Each brand has one owner who handles brand-conditional approval steps.
    """
    name = models.CharField(max_length=100, unique=True, help_text="Example: 'Apple', 'Samsung'")
    code = models.CharField(max_length=50, unique=True, help_text="Unique code for identification")
    owner = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='owned_brands',
        help_text="The user who handles approval for this brand"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    master_workflow_condition = models.ForeignKey(
        MasterWorkflowCriteria,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='master_workflow_conditions'
    )

    class Meta:
        db_table = 'aw_brand'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code})"


class UserBrand(models.Model):
    """
    Mapping users to brands.
    Used to track which user is responsible for which brand.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='user_brands'
    )
    brand = models.ForeignKey(
        Brand,
        on_delete=models.CASCADE,
        related_name='brand_users'
    )

    class Meta:
        db_table = 'aw_user_brand'
        unique_together = ['user', 'brand']

    def __str__(self):
        return f"{self.user.username} -> {self.brand.name}"
