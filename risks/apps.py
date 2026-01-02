"""
App configuration for the risks app.
"""

from django.apps import AppConfig


class RisksConfig(AppConfig):
    """Configuration for the Risks app."""
    
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'risks'
    verbose_name = 'Risk Management'

    def ready(self):
        import risks.signals
