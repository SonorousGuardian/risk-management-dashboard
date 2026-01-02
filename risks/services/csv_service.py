"""
CSV Service for loading risk data from CSV files.
"""

import io
import pandas as pd
from datetime import datetime
from django.conf import settings
from risks.models import Risk


class CSVService:
    """Service for handling CSV file operations."""
    
    def __init__(self, file_path=None):
        """Initialize with optional custom file path."""
        self.file_path = file_path or settings.CSV_FILE_PATH
    
    def load_risks_from_csv(self):
        """
        Load risks from CSV file and sync to database.
        Returns statistics about the operation.
        """
        try:
            # Read CSV file
            df = pd.read_csv(self.file_path)
            
            # Clean column names
            df.columns = df.columns.str.strip()
            
            created_count = 0
            updated_count = 0
            errors = []
            
            for index, row in df.iterrows():
                try:
                    risk_data = self._parse_row(row)
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
                'message': f"CSV sync completed successfully.",
                'created': created_count,
                'updated': updated_count,
                'total_processed': created_count + updated_count,
                'errors': errors if errors else None
            }
            
        except FileNotFoundError:
            return {
                'success': False,
                'message': f"CSV file not found at: {self.file_path}",
                'error': 'FILE_NOT_FOUND'
            }
        except Exception as e:
            return {
                'success': False,
                'message': f"Error loading CSV: {str(e)}",
                'error': str(e)
            }
    
    def _parse_row(self, row):
        """Parse a CSV row into a risk data dictionary."""
        try:
            # Skip empty rows
            if pd.isna(row.get('Risk ID')) or str(row.get('Risk ID')).strip() == '':
                return None
            
            # Parse date
            last_updated = row.get('Last Updated')
            if pd.notna(last_updated):
                if isinstance(last_updated, str):
                    last_updated = datetime.strptime(last_updated, '%Y-%m-%d').date()
            else:
                last_updated = datetime.now().date()
            
            # Determine is_mitigated based on status
            status = str(row.get('Status', 'Open')).strip()
            is_mitigated = status in ['Mitigated', 'Closed']
            
            return {
                'risk_id': str(row.get('Risk ID')).strip(),
                'title': str(row.get('Title', '')).strip(),
                'risk_owner': str(row.get('Risk Owner', '')).strip(),
                'risk_category': str(row.get('Risk Category', '')).strip(),
                'likelihood': int(row.get('Likelihood', 1)),
                'impact': int(row.get('Impact', 1)),
                'status': status,
                'control_effectiveness': str(row.get('Control Effectiveness', 'Medium')).strip(),
                'last_updated': last_updated,
                'is_mitigated': is_mitigated,
            }
        except Exception as e:
            raise ValueError(f"Error parsing row: {str(e)}")
    
    def export_to_csv(self, file_path=None):
        """Export current risks to CSV file."""
        export_path = file_path or self.file_path.replace('.csv', '_export.csv')
        
        risks = Risk.objects.all().values(
            'risk_id', 'title', 'risk_owner', 'risk_category',
            'likelihood', 'impact', 'risk_score', 'status',
            'control_effectiveness', 'last_updated', 'is_mitigated'
        )
        
        df = pd.DataFrame(list(risks))
        
        # Rename columns to match expected format
        df.rename(columns={
            'risk_id': 'Risk ID',
            'title': 'Title',
            'risk_owner': 'Risk Owner',
            'risk_category': 'Risk Category',
            'likelihood': 'Likelihood',
            'impact': 'Impact',
            'risk_score': 'Risk Score',
            'status': 'Status',
            'control_effectiveness': 'Control Effectiveness',
            'last_updated': 'Last Updated',
            'is_mitigated': 'Is Mitigated'
        }, inplace=True)
        
        # Format boolean
        if 'Is Mitigated' in df.columns:
            df['Is Mitigated'] = df['Is Mitigated'].apply(lambda x: 'Yes' if x else 'No')
        
        df.to_csv(export_path, index=False)
        
        return {
            'success': True,
            'message': f"Exported {len(df)} risks to {export_path}",
            'file_path': export_path
        }

    
    def export_to_csv_stream(self):
        """
        Generate CSV content and return as string.
        Uses Python's native csv module for reliability.
        """
        import csv
        
        # Fetch all risks from database
        risks = Risk.objects.all()
        
        if not risks.exists():
            return None
        
        # Create CSV content in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header row
        writer.writerow([
            'Risk ID', 'Title', 'Risk Owner', 'Risk Category',
            'Likelihood', 'Impact', 'Risk Score', 'Status',
            'Control Effectiveness', 'Last Updated', 'Is Mitigated'
        ])
        
        # Write data rows
        for risk in risks:
            writer.writerow([
                risk.risk_id,
                risk.title,
                risk.risk_owner,
                risk.risk_category,
                risk.likelihood,
                risk.impact,
                risk.risk_score,
                risk.status,
                risk.control_effectiveness,
                str(risk.last_updated),
                'Yes' if risk.is_mitigated else 'No'
            ])
        
        # Get the CSV content as string
        csv_content = output.getvalue()
        output.close()
        
        return csv_content
