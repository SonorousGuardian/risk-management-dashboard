"""
API Views for the Risk Management Application.
"""

import io
import tempfile
from django.db.models import Count, Avg, Q
from django.http import HttpResponse, FileResponse
from rest_framework import generics, status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser

from risks.models import Risk
from .serializers import RiskSerializer, RiskUpdateSerializer
from risks.services.csv_service import CSVService
from risks.services.google_sheets import GoogleSheetsService
from risks.services.report_service import ReportService


class RiskPagination(PageNumberPagination):
    """Custom pagination for risks."""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class RiskListView(generics.ListAPIView):
    """
    GET: List all risks with optional filtering.
    Query params: status, category, owner, search, min_score, max_score
    """
    serializer_class = RiskSerializer
    pagination_class = RiskPagination
    
    def get_queryset(self):
        queryset = Risk.objects.all()
        
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(risk_category=category)
        
        # Filter by owner
        owner = self.request.query_params.get('owner')
        if owner:
            queryset = queryset.filter(risk_owner=owner)
        
        # Filter by control effectiveness
        effectiveness = self.request.query_params.get('effectiveness')
        if effectiveness:
            queryset = queryset.filter(control_effectiveness=effectiveness)
        
        # Filter by mitigation status
        is_mitigated = self.request.query_params.get('is_mitigated')
        if is_mitigated is not None:
            queryset = queryset.filter(is_mitigated=is_mitigated.lower() == 'true')
        
        # Filter by score range
        min_score = self.request.query_params.get('min_score')
        if min_score:
            queryset = queryset.filter(risk_score__gte=int(min_score))
        
        max_score = self.request.query_params.get('max_score')
        if max_score:
            queryset = queryset.filter(risk_score__lte=int(max_score))
        
        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(risk_id__icontains=search) |
                Q(title__icontains=search)
            )
        
        # Sorting
        sort_by = self.request.query_params.get('sort_by', '-risk_score')
        if sort_by:
            queryset = queryset.order_by(sort_by)
        
        return queryset


class RiskDetailView(generics.RetrieveUpdateAPIView):
    """
    GET: Retrieve a single risk.
    PATCH/PUT: Update a risk.
    """
    queryset = Risk.objects.all()
    
    def get_serializer_class(self):
        if self.request.method in ['PATCH', 'PUT']:
            return RiskUpdateSerializer
        return RiskSerializer


@api_view(['POST'])
def toggle_mitigated(request, pk):
    """Toggle the is_mitigated status of a risk and update status field."""
    try:
        risk = Risk.objects.get(pk=pk)
        risk.is_mitigated = not risk.is_mitigated
        
        # Also update the status field so charts reflect the change
        if risk.is_mitigated:
            risk.status = 'Mitigated'
        else:
            # If un-mitigating, set back to Open (unless it was Closed/Accepted)
            if risk.status == 'Mitigated':
                risk.status = 'Open'
        
        risk.save()
        return Response({
            'id': risk.id,
            'risk_id': risk.risk_id,
            'is_mitigated': risk.is_mitigated,
            'status': risk.status,
            'message': f"Risk {risk.risk_id} mitigation status updated."
        })
    except Risk.DoesNotExist:
        return Response(
            {'error': 'Risk not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
def dashboard_stats(request):
    """Get dashboard statistics."""
    risks = Risk.objects.all()
    total = risks.count()
    
    if total == 0:
        return Response({
            'total_risks': 0,
            'critical_risks': 0,
            'high_risks': 0,
            'medium_risks': 0,
            'low_risks': 0,
            'open_risks': 0,
            'mitigated_risks': 0,
            'closed_risks': 0,
            'accepted_risks': 0,
            'average_score': 0,
            'mitigated_percentage': 0,
        })
    
    # Count by severity
    critical = risks.filter(risk_score__gte=15).count()
    high = risks.filter(risk_score__gte=8, risk_score__lt=15).count()
    medium = risks.filter(risk_score__gte=4, risk_score__lt=8).count()
    low = risks.filter(risk_score__lt=4).count()
    
    # Count by status
    open_count = risks.filter(status='Open').count()
    mitigated_count = risks.filter(status='Mitigated').count()
    closed_count = risks.filter(status='Closed').count()
    accepted_count = risks.filter(status='Accepted').count()
    
    # Average score
    avg_score = risks.aggregate(Avg('risk_score'))['risk_score__avg'] or 0
    
    # Mitigated percentage (status = Mitigated or is_mitigated = True)
    mitigated_or_checked = risks.filter(
        Q(status='Mitigated') | Q(is_mitigated=True)
    ).count()
    mitigated_pct = (mitigated_or_checked / total) * 100 if total > 0 else 0
    
    return Response({
        'total_risks': total,
        'critical_risks': critical,
        'high_risks': high,
        'medium_risks': medium,
        'low_risks': low,
        'open_risks': open_count,
        'mitigated_risks': mitigated_count,
        'closed_risks': closed_count,
        'accepted_risks': accepted_count,
        'average_score': round(avg_score, 1),
        'mitigated_percentage': round(mitigated_pct, 1),
    })


@api_view(['GET'])
def risk_matrix_data(request):
    """Get risk matrix data (5x5 grid with risk counts)."""
    matrix = {}
    
    for likelihood in range(1, 6):
        for impact in range(1, 6):
            count = Risk.objects.filter(
                likelihood=likelihood,
                impact=impact
            ).count()
            key = f"{likelihood}_{impact}"
            matrix[key] = {
                'likelihood': likelihood,
                'impact': impact,
                'count': count,
                'score': likelihood * impact
            }
    
    return Response(matrix)


@api_view(['GET'])
def category_stats(request):
    """Get risk counts by category."""
    stats = Risk.objects.values('risk_category').annotate(
        count=Count('id'),
        avg_score=Avg('risk_score')
    ).order_by('-count')
    
    return Response(list(stats))


@api_view(['GET'])
def status_stats(request):
    """Get risk counts by status."""
    stats = Risk.objects.values('status').annotate(
        count=Count('id')
    ).order_by('-count')
    
    return Response(list(stats))


@api_view(['GET'])
def owner_stats(request):
    """Get risk counts by owner."""
    stats = Risk.objects.values('risk_owner').annotate(
        count=Count('id'),
        avg_score=Avg('risk_score')
    ).order_by('-count')
    
    return Response(list(stats))


@api_view(['GET'])
def effectiveness_stats(request):
    """Get risk counts by control effectiveness."""
    stats = Risk.objects.values('control_effectiveness').annotate(
        count=Count('id')
    ).order_by('-count')
    
    return Response(list(stats))


@api_view(['POST'])
def sync_from_csv(request):
    """Sync risks from CSV file."""
    try:
        service = CSVService()
        result = service.load_risks_from_csv()
        return Response(result)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def sync_from_sheets(request):
    """Sync risks from Google Sheets."""
    try:
        service = GoogleSheetsService()
        result = service.sync_from_sheets()
        return Response(result)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_csv(request):
    """Upload and process a CSV file with risk data."""
    try:
        if 'file' not in request.FILES:
            return Response(
                {'error': 'No file provided. Please upload a CSV file.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        csv_file = request.FILES['file']
        
        # Validate file type
        if not csv_file.name.endswith('.csv'):
            return Response(
                {'error': 'Invalid file type. Please upload a CSV file.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save to temp file and process
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.csv', delete=False) as temp_file:
            for chunk in csv_file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name
        
        # Process the uploaded CSV
        service = CSVService(file_path=temp_path)
        result = service.load_risks_from_csv()
        
        # Clean up temp file
        import os
        os.unlink(temp_path)
        
        return Response(result)
        
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def download_pdf_report(request):
    """Generate and download a PDF report."""
    try:
        service = ReportService()
        pdf_buffer = service.generate_pdf_report()
        
        response = HttpResponse(pdf_buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="risk_management_report.pdf"'
        return response
        
    except ImportError as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'Error generating PDF report: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def download_excel_report(request):
    """Download comprehensive Excel report."""
    from risks.services.report_service import ReportService
    from datetime import datetime
    
    try:
        # Generate Excel content
        service = ReportService()
        excel_content = service.generate_excel_report()
        
        if not excel_content:
            return HttpResponse("No risk data available to export.", status=404)
        
        # Create response with Excel content
        response = HttpResponse(
            excel_content, 
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        
        # Force download with timestamped filename
        filename = f"risk_register_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        return HttpResponse(f'Error generating Excel report: {str(e)}', status=500)


def download_updated_csv(request):
    """Generate and download enhanced CSV with summary stats, risk matrix, and charts data."""
    import csv
    import io
    from datetime import datetime
    from django.db.models import Count, Avg
    from risks.models import Risk
    
    try:
        # Fetch all risks
        risks_qs = Risk.objects.all()
        
        if not risks_qs.exists():
            return HttpResponse("No risk data available to export.", status=404)
        
        # Build CSV in memory
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        
        # ============================================
        # SECTION 1: SUMMARY STATISTICS
        # ============================================
        writer.writerow(['=== RISK REGISTER SUMMARY ==='])
        writer.writerow(['Generated', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
        writer.writerow([])
        
        total_risks = risks_qs.count()
        mitigated_risks = risks_qs.filter(is_mitigated=True).count()
        open_risks = risks_qs.filter(status='Open').count()
        critical_risks = risks_qs.filter(risk_score__gte=15).count()
        high_risks = risks_qs.filter(risk_score__gte=8, risk_score__lt=15).count()
        avg_score = risks_qs.aggregate(avg=Avg('risk_score'))['avg'] or 0
        
        writer.writerow(['Metric', 'Value'])
        writer.writerow(['Total Risks', total_risks])
        writer.writerow(['Critical Risks (Score >= 15)', critical_risks])
        writer.writerow(['High Risks (Score 8-14)', high_risks])
        writer.writerow(['Open Risks', open_risks])
        writer.writerow(['Mitigated Risks', mitigated_risks])
        writer.writerow(['Average Risk Score', round(avg_score, 2)])
        writer.writerow([])
        
        # ============================================
        # SECTION 2: RISK MATRIX (5x5 Grid Counts)
        # ============================================
        writer.writerow(['=== RISK MATRIX (Likelihood x Impact) ==='])
        writer.writerow(['', 'Impact 1', 'Impact 2', 'Impact 3', 'Impact 4', 'Impact 5'])
        
        for likelihood in range(5, 0, -1):
            row = [f'Likelihood {likelihood}']
            for impact in range(1, 6):
                count = risks_qs.filter(likelihood=likelihood, impact=impact).count()
                row.append(count)
            writer.writerow(row)
        writer.writerow([])
        
        # ============================================
        # SECTION 3: CATEGORY DISTRIBUTION
        # ============================================
        writer.writerow(['=== RISKS BY CATEGORY ==='])
        writer.writerow(['Category', 'Count'])
        category_counts = risks_qs.values('risk_category').annotate(count=Count('id')).order_by('-count')
        for cat in category_counts:
            writer.writerow([cat['risk_category'], cat['count']])
        writer.writerow([])
        
        # ============================================
        # SECTION 4: STATUS DISTRIBUTION
        # ============================================
        writer.writerow(['=== RISKS BY STATUS ==='])
        writer.writerow(['Status', 'Count'])
        status_counts = risks_qs.values('status').annotate(count=Count('id')).order_by('-count')
        for stat in status_counts:
            writer.writerow([stat['status'], stat['count']])
        writer.writerow([])
        
        # ============================================
        # SECTION 5: FULL RISK DATA
        # ============================================
        writer.writerow(['=== ALL RISKS ==='])
        writer.writerow([
            'Risk ID', 'Title', 'Risk Owner', 'Risk Category',
            'Likelihood', 'Impact', 'Risk Score', 'Status',
            'Control Effectiveness', 'Last Updated', 'Is Mitigated'
        ])
        
        risks = risks_qs.values(
            'risk_id', 'title', 'risk_owner', 'risk_category',
            'likelihood', 'impact', 'risk_score', 'status',
            'control_effectiveness', 'last_updated', 'is_mitigated'
        )
        
        for r in risks:
            writer.writerow([
                r['risk_id'],
                r['title'],
                r['risk_owner'],
                r['risk_category'],
                r['likelihood'],
                r['impact'],
                r['risk_score'],
                r['status'],
                r['control_effectiveness'],
                str(r['last_updated']),
                'Yes' if r['is_mitigated'] else 'No'
            ])
        
        csv_content = buffer.getvalue()
        buffer.close()
        
        # Create response with proper headers
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"risk_register_full_report_{timestamp}.csv"
        
        response = HttpResponse(csv_content, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        
        return response
        
    except Exception as e:
        return HttpResponse(f"Error generating CSV: {str(e)}", status=500)

