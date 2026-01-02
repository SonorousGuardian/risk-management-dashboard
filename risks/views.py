"""
Views for the risks app - serving HTML templates.
"""

from django.shortcuts import render
from django.views.generic import TemplateView


class DashboardView(TemplateView):
    """Main dashboard view."""
    template_name = 'dashboard.html'


def dashboard(request):
    """Dashboard view function."""
    return render(request, 'dashboard.html')
