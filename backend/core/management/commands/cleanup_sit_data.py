"""
Management Command: cleanup_sit_data
====================================
Purges SIT testing transactions (ApprovalRequest, ApprovalStep, AuditLog,
RequestFeedback, RequestWatcher, PRNonTrade, PRNonTradeItem), recalculates
PRNonTradeSequence running numbers from remaining production records, and
optionally removes the SIT role from target user(s) when ready for Go-Live.

Usage examples:
  python manage.py cleanup_sit_data --dry-run
  python manage.py cleanup_sit_data
  python manage.py cleanup_sit_data --user prasetyama.hidayat --remove-sit-role
"""
from django.core.management.base import BaseCommand
from core.engine import WorkflowEngine


class Command(BaseCommand):
    help = 'Clean up SIT testing transaction data, reset PR running number sequences, and optionally remove SIT role.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            default=None,
            help='Username or email of a specific user to clean up SIT data for (default: all SIT users & test transactions).',
        )
        parser.add_argument(
            '--remove-sit-role',
            action='store_true',
            help='Also remove the SIT role from the target user(s) after purging test data (transition to Production).',
        )
        parser.add_argument(
            '--no-reset-sequences',
            action='store_true',
            help='Do not recalculate PRNonTradeSequence counters.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview how many records will be deleted without modifying the database.',
        )

    def handle(self, *args, **options):
        user_arg = options.get('user')
        remove_sit_role = options.get('remove_sit_role', False)
        reset_sequences = not options.get('no_reset_sequences', False)
        dry_run = options.get('dry_run', False)

        summary = WorkflowEngine.cleanup_sit_data(
            username_or_email=user_arg,
            remove_sit_role=remove_sit_role,
            reset_sequences=reset_sequences,
            dry_run=dry_run,
        )

        mode_label = "[DRY-RUN PREVIEW]" if dry_run else "[EXECUTED]"
        self.stdout.write(self.style.WARNING(f"\n{mode_label} SIT Data Cleanup Summary:"))
        self.stdout.write(f"  Target Users            : {', '.join(summary['affected_users']) or '(None)'}")
        self.stdout.write(f"  Approval Requests       : {summary['approval_requests_deleted']}")
        self.stdout.write(f"  Approval Steps          : {summary['approval_steps_deleted']}")
        self.stdout.write(f"  Audit Logs              : {summary['audit_logs_deleted']}")
        self.stdout.write(f"  PR Non-Trade Headers    : {summary['pr_non_trade_deleted']}")
        self.stdout.write(f"  PR Non-Trade Items      : {summary['pr_non_trade_items_deleted']}")
        self.stdout.write(f"  SIT Roles Removed       : {summary['sit_roles_removed']}")

        if summary['sequences_reset']:
            self.stdout.write("  PR Sequence Resets      :")
            for seq in summary['sequences_reset']:
                self.stdout.write(
                    f"    - {seq['code_name']}/{seq['year']}: {seq['old_last_number']} -> {seq['new_last_number']}"
                )

        if dry_run:
            self.stdout.write(self.style.NOTICE("\nNo data was deleted (--dry-run). Remove --dry-run to execute."))
        else:
            self.stdout.write(self.style.SUCCESS("\nSIT testing data cleanup completed successfully!"))
