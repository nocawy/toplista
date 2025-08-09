# serializers.py
from rest_framework import serializers
from django.contrib.auth import authenticate
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


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        user = authenticate(username=data.get("username"), password=data.get("password"))
        if user:
            return user
        raise serializers.ValidationError("Incorrect Username or Password.")
