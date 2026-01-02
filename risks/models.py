"""
Risk models for the Risk Management Application.
"""

from django.db import models


class Risk(models.Model):
    """Model representing a risk in the risk register."""
    
    # Status choices
    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('Mitigated', 'Mitigated'),
        ('Closed', 'Closed'),
        ('Accepted', 'Accepted'),
    ]
    
    # Control effectiveness choices
    CONTROL_EFFECTIVENESS_CHOICES = [
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High'),
    ]
    
    # Risk category choices
    CATEGORY_CHOICES = [
        ('Access Control', 'Access Control'),
        ('Business Continuity', 'Business Continuity'),
        ('Configuration', 'Configuration'),
        ('Data Protection', 'Data Protection'),
        ('Third-party', 'Third-party'),
    ]
    
    # Risk owner choices
    OWNER_CHOICES = [
        ('Compliance', 'Compliance'),
        ('Finance', 'Finance'),
        ('IT', 'IT'),
        ('Operations', 'Operations'),
        ('Security', 'Security'),
    ]
    
    # Fields
    risk_id = models.CharField(max_length=20, unique=True, db_index=True)
    title = models.CharField(max_length=255)
    risk_owner = models.CharField(max_length=50, choices=OWNER_CHOICES)
    risk_category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    likelihood = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    impact = models.IntegerField(choices=[(i, i) for i in range(1, 6)])
    risk_score = models.IntegerField(editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    control_effectiveness = models.CharField(
        max_length=20, 
        choices=CONTROL_EFFECTIVENESS_CHOICES, 
        default='Medium'
    )
    last_updated = models.DateField(auto_now=True)
    is_mitigated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-risk_score', '-last_updated']
        verbose_name = 'Risk'
        verbose_name_plural = 'Risks'
    
    def save(self, *args, **kwargs):
        """Calculate risk score before saving."""
        self.risk_score = self.likelihood * self.impact
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.risk_id}: {self.title}"
    
    @property
    def severity_level(self):
        """Return severity level based on risk score."""
        if self.risk_score >= 15:
            return 'Critical'
        elif self.risk_score >= 8:
            return 'High'
        elif self.risk_score >= 4:
            return 'Medium'
        return 'Low'
    
    @property
    def severity_color(self):
        """Return color code for severity level."""
        colors = {
            'Critical': '#ef4444',
            'High': '#f97316',
            'Medium': '#f59e0b',
            'Low': '#22c55e',
        }
        return colors.get(self.severity_level, '#6b7280')
