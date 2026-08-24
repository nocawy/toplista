from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase

from .views import LoginRateThrottle


class LoginThrottleTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_repeated_login_attempts_are_throttled(self):
        with patch.object(LoginRateThrottle, "rate", "2/min"):
            self.client.post("/api/login/", {"username": "nobody", "password": "bad"})
            self.client.post("/api/login/", {"username": "nobody", "password": "bad"})
            response = self.client.post("/api/login/", {"username": "nobody", "password": "bad"})

        self.assertEqual(response.status_code, 429)
