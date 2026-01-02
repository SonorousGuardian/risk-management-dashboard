"""
URL patterns for the risks app.
"""

from django.urls import path
from . import views

app_name = 'risks'

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
]
