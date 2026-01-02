"""
URL patterns for the risks API.
"""

from django.urls import path
from . import views

app_name = 'risks_api'

urlpatterns = [
    # Risk CRUD endpoints
    path('risks/', views.RiskListView.as_view(), name='risk-list'),
    path('risks/<int:pk>/', views.RiskDetailView.as_view(), name='risk-detail'),
    path('risks/<int:pk>/toggle-mitigated/', views.toggle_mitigated, name='toggle-mitigated'),
    
    # Statistics endpoints
    path('stats/', views.dashboard_stats, name='dashboard-stats'),
    path('stats/matrix/', views.risk_matrix_data, name='risk-matrix'),
    path('stats/categories/', views.category_stats, name='category-stats'),
    path('stats/status/', views.status_stats, name='status-stats'),
    path('stats/owners/', views.owner_stats, name='owner-stats'),
    path('stats/effectiveness/', views.effectiveness_stats, name='effectiveness-stats'),
    
    # Data sync endpoints
    path('sync/csv/', views.sync_from_csv, name='sync-csv'),
    path('sync/sheets/', views.sync_from_sheets, name='sync-sheets'),
    
    # CSV Upload endpoint
    path('upload/csv/', views.upload_csv, name='upload-csv'),
    
    # Report download endpoints
    path('reports/pdf/', views.download_pdf_report, name='download-pdf'),
    path('reports/excel/', views.download_excel_report, name='download-excel'),
    path('reports/csv/updated/', views.download_updated_csv, name='download-updated-csv'),
]

