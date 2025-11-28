"""
Currency localization and conversion based on IP geolocation
"""
from decimal import Decimal, ROUND_DOWN
import requests
from django.core.cache import cache

# Exchange rates (will be updated from API)
EXCHANGE_RATES = {
    'KGS': Decimal('89.50'),  # 1 USD = 89.50 KGS (сом)
    'KZT': Decimal('450.00'),  # 1 USD = 450.00 KZT (тенге)
    'USD': Decimal('1.00'),
}

# Currency symbols
CURRENCY_SYMBOLS = {
    'KGS': 'сом',
    'KZT': '₸',
    'USD': '$',
}

# Country to currency mapping
COUNTRY_CURRENCY = {
    'KG': 'KGS',  # Kyrgyzstan
    'KZ': 'KZT',  # Kazakhstan
    'US': 'USD',  # USA (default)
    'RU': 'USD',  # Russia (default to USD)
    'UZ': 'USD',  # Uzbekistan (default to USD)
}

def get_country_from_ip(ip_address):
    """
    Get country code from IP address using free API
    Optimized with caching and fast fallback for local IPs
    """
    if not ip_address:
        return 'US'
    
    # Fast path for local IPs - no API call needed
    if ip_address == '127.0.0.1' or (isinstance(ip_address, str) and (
        ip_address.startswith('192.168.') or 
        ip_address.startswith('10.') or 
        ip_address.startswith('172.')
    )):
        # Local IP, default to Kyrgyzstan for testing
        return 'KG'
    
    # Check cache first
    try:
        cache_key = f'ip_country_{ip_address}'
        cached_country = cache.get(cache_key)
        if cached_country:
            return cached_country
    except Exception:
        # If cache fails, continue without cache
        pass
    
    # Make API request with short timeout
    try:
        # Using ip-api.com (free, no key required, very fast)
        # Using minimal fields to reduce response time
        response = requests.get(
            f'http://ip-api.com/json/{ip_address}?fields=countryCode',
            timeout=0.5,  # Very short timeout - 500ms max
            headers={'User-Agent': 'Django-App/1.0'}
        )
        if response.status_code == 200:
            data = response.json()
            country_code = data.get('countryCode', 'US')
            # Cache for 24 hours
            try:
                cache.set(cache_key, country_code, 86400)
            except Exception:
                pass  # If cache fails, continue without caching
            return country_code
    except (requests.RequestException, ValueError, KeyError, Exception):
        # If API fails, cache a default value for 1 hour to avoid repeated failures
        try:
            cache.set(cache_key, 'US', 3600)
        except Exception:
            pass
        pass
    
    # Fallback to default
    return 'US'

def get_currency_for_country(country_code):
    """
    Get currency code for country
    """
    return COUNTRY_CURRENCY.get(country_code.upper(), 'USD')

def fetch_exchange_rates():
    """
    Fetch current exchange rates from API
    Optimized to use cache and avoid blocking
    """
    # Check cache first - this is fast
    cached_rates = cache.get('exchange_rates')
    if cached_rates:
        return cached_rates
    
    # If not in cache, try to fetch (but don't block if it fails)
    try:
        # Using exchangerate-api.com (free tier) with short timeout
        response = requests.get('https://api.exchangerate-api.com/v4/latest/USD', timeout=1)
        if response.status_code == 200:
            data = response.json()
            rates = data.get('rates', {})
            
            # Update rates
            updated_rates = EXCHANGE_RATES.copy()
            if 'KGS' in rates:
                updated_rates['KGS'] = Decimal(str(rates['KGS']))
            if 'KZT' in rates:
                updated_rates['KZT'] = Decimal(str(rates['KZT']))
            
            # Cache for 6 hours (rates don't change that often)
            cache.set('exchange_rates', updated_rates, 21600)
            return updated_rates
    except Exception:
        # If API fails, use default rates and cache them for 1 hour
        # This prevents repeated failed requests
        cache.set('exchange_rates', EXCHANGE_RATES, 3600)
        pass
    
    # Return default rates if all else fails
    return EXCHANGE_RATES

def get_exchange_rate(currency_code):
    """
    Get exchange rate for currency
    """
    rates = fetch_exchange_rates()
    return rates.get(currency_code.upper(), Decimal('1.00'))

def convert_price(usd_amount, target_currency='USD'):
    """
    Convert USD price to target currency
    """
    if target_currency == 'USD':
        return usd_amount
    
    rate = get_exchange_rate(target_currency)
    converted = Decimal(str(usd_amount)) * rate
    
    # Round to 2 decimal places for KGS and KZT
    if target_currency in ['KGS', 'KZT']:
        converted = converted.quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    else:
        converted = converted.quantize(Decimal('0.01'), rounding=ROUND_DOWN)
    
    return converted

def format_price(price, currency_code='USD'):
    """
    Format price with currency symbol
    """
    symbol = CURRENCY_SYMBOLS.get(currency_code, '$')
    
    if currency_code == 'KGS':
        # For KGS, show as "XXX сом"
        return f"{price:,.2f} {symbol}".replace(',', ' ').replace('.', ',')
    elif currency_code == 'KZT':
        # For KZT, show as "XXX ₸"
        return f"{price:,.0f} {symbol}".replace(',', ' ')
    else:
        # For USD, show as "$XXX.XX"
        return f"{symbol}{price:,.2f}"

def get_user_currency(request):
    """
    Get currency for user based on IP or session
    """
    if not request:
        return 'USD'
    
    # Check session first (user preference)
    if hasattr(request, 'session') and 'currency' in request.session:
        return request.session['currency']
    
    # Get from request metadata (set by middleware)
    if hasattr(request, 'user_currency'):
        return request.user_currency
    
    # Default to USD
    return 'USD'

