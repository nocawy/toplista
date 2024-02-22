from rest_framework import serializers
from .models import Song

class SongSerializer(serializers.ModelSerializer):
    r_rank = serializers.IntegerField(source='rank.r_rank', read_only=True)
    
    class Meta:
        model = Song
        fields = [field.name for field in Song._meta.fields] + ['r_rank']

    def validate_s_yt_id(self, value):
        """Checks if the s_yt_id has exactly 11 characters."""
        if len(value) != 11:
            raise serializers.ValidationError("YT ID must be exactly 11 characters long.")
        return value
