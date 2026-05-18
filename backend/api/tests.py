from django.test import TestCase

from .models import Ranking
from .serializers import RankingSerializer


class RankingSerializerTests(TestCase):
    def test_create_generates_slug_from_name(self):
        serializer = RankingSerializer(data={"name": "Concert Ranking"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        ranking = serializer.save()

        self.assertEqual(ranking.name, "Concert Ranking")
        self.assertEqual(ranking.slug, "concert-ranking")

    def test_create_generates_unique_slug_on_collision(self):
        Ranking.objects.create(name="Concert Ranking", slug="concert-ranking")
        serializer = RankingSerializer(data={"name": "Concert Ranking"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        ranking = serializer.save()

        self.assertEqual(ranking.slug, "concert-ranking-2")

    def test_create_preserves_explicit_slug(self):
        serializer = RankingSerializer(data={"name": "Concert Ranking", "slug": "live"})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        ranking = serializer.save()

        self.assertEqual(ranking.slug, "live")
