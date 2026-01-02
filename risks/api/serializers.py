"""
Serializers for the Risk API.
"""

from rest_framework import serializers
from risks.models import Risk


class RiskSerializer(serializers.ModelSerializer):
    """Serializer for Risk model."""
    
    severity_level = serializers.ReadOnlyField()
    severity_color = serializers.ReadOnlyField()
    
    class Meta:
        model = Risk
        fields = [
            'id', 'risk_id', 'title', 'risk_owner', 'risk_category',
            'likelihood', 'impact', 'risk_score', 'status',
            'control_effectiveness', 'last_updated', 'is_mitigated',
            'severity_level', 'severity_color', 'created_at'
        ]
        read_only_fields = ['risk_score', 'created_at']


class RiskUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating Risk model."""
    
    class Meta:
        model = Risk
        fields = ['status', 'is_mitigated', 'control_effectiveness']


class RiskStatsSerializer(serializers.Serializer):
    """Serializer for dashboard statistics."""
    
    total_risks = serializers.IntegerField()
    critical_risks = serializers.IntegerField()
    high_risks = serializers.IntegerField()
    medium_risks = serializers.IntegerField()
    low_risks = serializers.IntegerField()
    open_risks = serializers.IntegerField()
    mitigated_risks = serializers.IntegerField()
    closed_risks = serializers.IntegerField()
    accepted_risks = serializers.IntegerField()
    average_score = serializers.FloatField()
    mitigated_percentage = serializers.FloatField()
