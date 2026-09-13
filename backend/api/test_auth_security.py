from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

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


class JwtSettingsTests(TestCase):
    def test_refresh_tokens_last_fourteen_days_and_rotate(self):
        self.assertEqual(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"], timedelta(minutes=5))
        self.assertEqual(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"], timedelta(days=14))
        self.assertTrue(settings.SIMPLE_JWT["ROTATE_REFRESH_TOKENS"])
        self.assertTrue(settings.SIMPLE_JWT["BLACKLIST_AFTER_ROTATION"])


class TokenRefreshRotationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="alice", password="secret")
        self.client = APIClient()

    def _refresh(self, token):
        return self.client.post("/api/token/refresh/", {"refresh": token}, format="json")

    def test_login_refresh_token_expires_in_fourteen_days(self):
        response = self.client.post(
            "/api/login/",
            {"username": "alice", "password": "secret"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        token = RefreshToken(response.data["refresh"])
        self.assertAlmostEqual(
            token["exp"] - token["iat"],
            int(timedelta(days=14).total_seconds()),
            delta=2,
        )

    def test_refresh_returns_a_new_refresh_token(self):
        original = str(RefreshToken.for_user(self.user))

        response = self._refresh(original)

        self.assertEqual(response.status_code, 200)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertNotEqual(response.data["refresh"], original)

        rotated = RefreshToken(response.data["refresh"])
        self.assertAlmostEqual(
            rotated["exp"] - rotated["iat"],
            int(timedelta(days=14).total_seconds()),
            delta=2,
        )

    def test_old_refresh_token_is_rejected_after_rotation(self):
        original = str(RefreshToken.for_user(self.user))

        first = self._refresh(original)
        self.assertEqual(first.status_code, 200)

        reused = self._refresh(original)
        self.assertEqual(reused.status_code, 401)

    def test_rotated_refresh_token_can_be_used_again(self):
        original = str(RefreshToken.for_user(self.user))

        first = self._refresh(original)
        second = self._refresh(first.data["refresh"])

        self.assertEqual(second.status_code, 200)
        self.assertNotEqual(second.data["refresh"], first.data["refresh"])

