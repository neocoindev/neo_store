"""
Template tags for currency formatting
"""
from django import template
from plugin.currency import convert_price, format_price, get_user_currency

register = template.Library()

@register.simple_tag(takes_context=True)
def format_currency(context, price, currency_code=None):
    """
    Format price with currency based on user's location
    
    Usage: {% format_currency product.price %}
    """
    try:
        request = context.get('request')
        
        if not currency_code and request:
            try:
                currency_code = get_user_currency(request)
            except Exception:
                currency_code = 'USD'
        elif not currency_code:
            currency_code = 'USD'
        
        # Convert price if needed
        try:
            price_float = float(price) if price else 0.0
            if currency_code != 'USD':
                converted_price = convert_price(price_float, currency_code)
            else:
                converted_price = price_float
            
            return format_price(converted_price, currency_code)
        except (ValueError, TypeError):
            # If price conversion fails, return as USD
            return format_price(float(price) if price else 0.0, 'USD')
    except Exception:
        # Fallback to USD if anything goes wrong
        try:
            return format_price(float(price) if price else 0.0, 'USD')
        except:
            return '$0.00'

@register.simple_tag(takes_context=True)
def get_price(context, price, currency_code=None):
    """
    Get converted price without formatting
    
    Usage: {% get_price product.price %}
    """
    try:
        request = context.get('request')
        
        if not currency_code and request:
            try:
                currency_code = get_user_currency(request)
            except Exception:
                currency_code = 'USD'
        elif not currency_code:
            currency_code = 'USD'
        
        try:
            price_float = float(price) if price else 0.0
            if currency_code != 'USD':
                converted_price = convert_price(price_float, currency_code)
            else:
                converted_price = price_float
            
            return converted_price
        except (ValueError, TypeError):
            return float(price) if price else 0.0
    except Exception:
        try:
            return float(price) if price else 0.0
        except:
            return 0.0

@register.simple_tag(takes_context=True)
def get_currency_symbol(context):
    """
    Get currency symbol for current user
    
    Usage: {% get_currency_symbol %}
    """
    from plugin.currency import CURRENCY_SYMBOLS, get_user_currency
    
    request = context.get('request')
    if request:
        currency_code = get_user_currency(request)
    else:
        currency_code = 'USD'
    
    return CURRENCY_SYMBOLS.get(currency_code, '$')

