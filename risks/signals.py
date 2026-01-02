from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Risk
from .services.csv_service import CSVService
import threading
import logging

logger = logging.getLogger(__name__)

# Track if we're currently exporting to avoid recursion/race conditions
_exporting_lock = threading.Lock()
_is_exporting = False

@receiver(post_save, sender=Risk)
@receiver(post_delete, sender=Risk)
def update_risk_csv(sender, instance, **kwargs):
    """
    Update the persistent CSV report whenever a risk is saved or deleted.
    Uses a lock to prevent concurrent writes and recursion.
    """
    global _is_exporting
    
    # Simple check to avoid blocking if already exporting (debounce-ish)
    if _is_exporting:
        return
        
    try:
        # Acquire lock to ensure safe write
        with _exporting_lock:
            _is_exporting = True
            service = CSVService()
            # Explicitly overwrite the original file to support sync
            service.export_to_csv(file_path=service.file_path)
    except Exception as e:
        logger.error(f"Error updating risk CSV: {e}")
    finally:
        _is_exporting = False
