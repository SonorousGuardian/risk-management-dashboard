"""
Google Sheets Service for syncing risk data with Google Sheets.
"""

import os
from datetime import datetime
from django.conf import settings

try:
    import gspread
    from oauth2client.service_account import ServiceAccountCredentials
    GSPREAD_AVAILABLE = True
except ImportError:
    GSPREAD_AVAILABLE = False

from risks.models import Risk


class GoogleSheetsService:
    """Service for handling Google Sheets integration."""
    
    SCOPES = [
        'https://spreadsheets.google.com/feeds',
        'https://www.googleapis.com/auth/drive'
    ]
    
    def __init__(self):
        """Initialize the Google Sheets service."""
        self.credentials_file = getattr(settings, 'GOOGLE_SHEETS_CREDENTIALS_FILE', '')
        self.sheet_id = getattr(settings, 'GOOGLE_SHEET_ID', '')
        self.client = None
        self.sheet = None
    
    def _connect(self):
        """Establish connection to Google Sheets."""
        if not GSPREAD_AVAILABLE:
            raise ImportError(
                "gspread and oauth2client are required for Google Sheets integration. "
                "Install them with: pip install gspread oauth2client"
            )
        
        if not self.credentials_file or not os.path.exists(self.credentials_file):
            raise FileNotFoundError(
                f"Google Sheets credentials file not found. "
                f"Please set GOOGLE_SHEETS_CREDENTIALS_FILE in your .env file."
            )
        
        if not self.sheet_id:
            raise ValueError(
                "Google Sheet ID not configured. "
                "Please set GOOGLE_SHEET_ID in your .env file."
            )
        
        credentials = ServiceAccountCredentials.from_json_keyfile_name(
            self.credentials_file,
            self.SCOPES
        )
        self.client = gspread.authorize(credentials)
        self.sheet = self.client.open_by_key(self.sheet_id).sheet1
    
    def sync_from_sheets(self):
        """
        Sync risks from Google Sheets to database.
        Returns statistics about the operation.
        """
        try:
            self._connect()
            
            # Get all records from sheet
            records = self.sheet.get_all_records()
            
            created_count = 0
            updated_count = 0
            errors = []
            
            for index, record in enumerate(records):
                try:
                    risk_data = self._parse_record(record)
                    if risk_data:
                        risk, created = Risk.objects.update_or_create(
                            risk_id=risk_data['risk_id'],
                            defaults=risk_data
                        )
                        if created:
                            created_count += 1
                        else:
                            updated_count += 1
                except Exception as e:
                    errors.append(f"Row {index + 2}: {str(e)}")
            
            return {
                'success': True,
                'message': "Google Sheets sync completed successfully.",
                'created': created_count,
                'updated': updated_count,
                'total_processed': created_count + updated_count,
                'errors': errors if errors else None
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f"Error syncing from Google Sheets: {str(e)}",
                'error': str(e)
            }
    
    def sync_to_sheets(self):
        """
        Sync risks from database to Google Sheets.
        Updates the entire sheet with current database data.
        """
        try:
            self._connect()
            
            # Get all risks from database
            risks = Risk.objects.all().order_by('risk_id')
            
            # Prepare header row
            headers = [
                'Risk ID', 'Title', 'Risk Owner', 'Risk Category',
                'Likelihood', 'Impact', 'Risk Score', 'Status',
                'Control Effectiveness', 'Last Updated'
            ]
            
            # Prepare data rows
            rows = [headers]
            for risk in risks:
                rows.append([
                    risk.risk_id,
                    risk.title,
                    risk.risk_owner,
                    risk.risk_category,
                    risk.likelihood,
                    risk.impact,
                    risk.risk_score,
                    risk.status,
                    risk.control_effectiveness,
                    str(risk.last_updated)
                ])
            
            # Clear and update sheet
            self.sheet.clear()
            self.sheet.update('A1', rows)
            
            return {
                'success': True,
                'message': f"Exported {len(risks)} risks to Google Sheets.",
                'total_exported': len(risks)
            }
            
        except Exception as e:
            return {
                'success': False,
                'message': f"Error syncing to Google Sheets: {str(e)}",
                'error': str(e)
            }
    
    def _parse_record(self, record):
        """Parse a Google Sheets record into a risk data dictionary."""
        try:
            risk_id = record.get('Risk ID', '')
            if not risk_id:
                return None
            
            # Parse date
            last_updated = record.get('Last Updated', '')
            if last_updated:
                try:
                    last_updated = datetime.strptime(last_updated, '%Y-%m-%d').date()
                except ValueError:
                    last_updated = datetime.now().date()
            else:
                last_updated = datetime.now().date()
            
            # Determine is_mitigated based on status
            status = str(record.get('Status', 'Open')).strip()
            is_mitigated = status in ['Mitigated', 'Closed']
            
            return {
                'risk_id': str(risk_id).strip(),
                'title': str(record.get('Title', '')).strip(),
                'risk_owner': str(record.get('Risk Owner', '')).strip(),
                'risk_category': str(record.get('Risk Category', '')).strip(),
                'likelihood': int(record.get('Likelihood', 1)),
                'impact': int(record.get('Impact', 1)),
                'status': status,
                'control_effectiveness': str(record.get('Control Effectiveness', 'Medium')).strip(),
                'last_updated': last_updated,
                'is_mitigated': is_mitigated,
            }
        except Exception as e:
            raise ValueError(f"Error parsing record: {str(e)}")
    
    def check_connection(self):
        """Check if Google Sheets connection is configured and working."""
        try:
            self._connect()
            return {
                'success': True,
                'message': "Google Sheets connection successful.",
                'sheet_title': self.sheet.title
            }
        except Exception as e:
            return {
                'success': False,
                'message': str(e)
            }
