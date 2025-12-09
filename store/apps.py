from django.apps import AppConfig
from django.template import defaultfilters


def length_is(value, arg):
    """Check if length equals arg (for Django 6.0 compatibility)"""
    try:
        return len(value) == int(arg)
    except (TypeError, ValueError, AttributeError):
        return False


class StoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'store'
    
    def ready(self):
        # Register length_is filter for Django 6.0 compatibility
        # This filter was removed in Django 6.0 but is still used by Jazzmin
        try:
            if 'length_is' not in defaultfilters.register.filters:
                defaultfilters.register.filter('length_is', length_is)
        except Exception:
            # If registration fails, try alternative method
            try:
                from django.template import engines
                engine = engines['django']
                engine.engine.template_libraries['django.template.defaultfilters'].filters['length_is'] = length_is
            except Exception:
                pass
