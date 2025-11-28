"""
Middleware for currency localization based on IP
"""
from plugin.currency import get_country_from_ip, get_currency_for_country
from django.core.cache import cache

class CurrencyMiddleware:
    """
    Middleware to detect user's country from IP and set currency
    Optimized to avoid blocking requests
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', '127.0.0.1')
        
        # Check session first - if currency is already set, use it (fast path)
        if 'currency' in request.session and 'country' in request.session:
            currency = request.session['currency']
            country_code = request.session['country']
        else:
            # Only make API call if not in session
            # Check cache first
            cache_key = f'ip_country_{ip}'
            country_code = cache.get(cache_key)
            
            if not country_code:
                # Get country from IP (with timeout and caching)
                country_code = get_country_from_ip(ip)
                # Cache for 24 hours
                cache.set(cache_key, country_code, 86400)
            
            # Get currency for country
            currency = get_currency_for_country(country_code)
            
            # Store in session to avoid future API calls
            request.session['currency'] = currency
            request.session['country'] = country_code
        
        # Store in request for template context
        request.user_country = country_code
        request.user_currency = currency
        request.user_ip = ip
        
        response = self.get_response(request)
        return response

