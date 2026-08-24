from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import TestCase


class InitializeAccountsTests(TestCase):
    def test_existing_admin_user_regains_required_privileges(self):
        admin = User.objects.create_user(
            username="admin",
            password="old-password",
            is_active=False,
            is_staff=False,
            is_superuser=False,
        )

        call_command("initialize_accounts", "new-password")

        admin.refresh_from_db()
        self.assertTrue(admin.is_active)
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.check_password("new-password"))
