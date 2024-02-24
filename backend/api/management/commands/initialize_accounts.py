# management/commands/initialize_accounts.py
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    # Example usage:
    # python manage.py initialize_accounts <new_admin_password>
    help = 'Initializes the admin and demo users. Sets or updates the password for the admin user.'

    def add_arguments(self, parser):
        parser.add_argument('admin_password', type=str, help='The password for the admin user.')

    def handle(self, *args, **options):
        admin_password = options['admin_password']
    
        # Create or update the admin user
        user, created = User.objects.get_or_create(username='admin', defaults={'is_staff': True, 'is_superuser': True})
        user.set_password(admin_password)
        user.save()
        status = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Successfully {status} admin user's password."))
    
        # Initialize the demo user with default password 'demo'
        demo_user, demo_created = User.objects.get_or_create(username='demo', defaults={'is_staff': False, 'is_superuser': False})
        if demo_created:
            demo_user.set_password('demo')
            demo_user.save()
            self.stdout.write(self.style.SUCCESS('Demo user created successfully with default password.'))
        else:
            self.stdout.write(self.style.SUCCESS('Demo user already exists.'))
