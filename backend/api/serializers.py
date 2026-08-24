# serializers.py
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.utils.text import slugify
from .models import Song, Ranking


class SongSerializer(serializers.ModelSerializer):
    # r_rank is provided by view annotation (per selected ranking)
    r_rank = serializers.IntegerField(read_only=True)

    class Meta:
        model = Song
        fields = [field.name for field in Song._meta.fields] + ["r_rank"]

    def validate_s_yt_id(self, value):
        """Checks if the s_yt_id has exactly 11 characters."""
        if len(value) != 11:
            raise serializers.ValidationError("YT ID must be exactly 11 characters long.")
        return value


class RankingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ranking
        fields = [field.name for field in Ranking._meta.fields]
        extra_kwargs = {"slug": {"required": False, "allow_blank": False}}

    @staticmethod
    def _unique_slug_from_name(name: str) -> str:
        max_length = Ranking._meta.get_field("slug").max_length
        base_slug = slugify(name)[:max_length] or "ranking"
        candidate = base_slug
        suffix = 2

        while Ranking.objects.filter(slug=candidate).exists():
            suffix_text = f"-{suffix}"
            candidate = f"{base_slug[: max_length - len(suffix_text)]}{suffix_text}"
            suffix += 1

        return candidate

    def create(self, validated_data):
        if not validated_data.get("slug"):
            validated_data["slug"] = self._unique_slug_from_name(validated_data["name"])

        return super().create(validated_data)


class RankUpdateSerializer(serializers.Serializer):
    songId = serializers.IntegerField(min_value=1)
    newRank = serializers.IntegerField(min_value=1)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        user = authenticate(username=data.get("username"), password=data.get("password"))
        if user:
            return user
        raise serializers.ValidationError("Incorrect Username or Password.")
