from rest_framework import serializers
from .models import Song

class SongSerializer(serializers.ModelSerializer):
    r_rank = serializers.IntegerField(source='rank.r_rank', read_only=True)
    
    class Meta:
        model = Song
        fields = [field.name for field in Song._meta.fields] + ['r_rank']
