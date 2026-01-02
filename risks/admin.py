"""
Admin configuration for the risks app.
"""

from django.contrib import admin
from .models import Risk


@admin.register(Risk)
class RiskAdmin(admin.ModelAdmin):
    """Admin configuration for Risk model."""
    
    list_display = [
        'risk_id', 'title', 'risk_owner', 'risk_category',
        'likelihood', 'impact', 'risk_score', 'status',
        'control_effectiveness', 'is_mitigated', 'last_updated'
    ]
    list_filter = ['status', 'risk_category', 'risk_owner', 'control_effectiveness', 'is_mitigated']
    search_fields = ['risk_id', 'title']
    ordering = ['-risk_score', '-last_updated']
    readonly_fields = ['risk_score', 'created_at']
