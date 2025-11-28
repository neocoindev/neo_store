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
    request = context.get('request')
    
    if not currency_code and request:
        currency_code = get_user_currency(request)
    elif not currency_code:
        currency_code = 'USD'
    
    # Convert price if needed
    if currency_code != 'USD':
        converted_price = convert_price(float(price), currency_code)
    else:
        converted_price = float(price)
    
    return format_price(converted_price, currency_code)

@register.simple_tag(takes_context=True)
def get_price(context, price, currency_code=None):
    """
    Get converted price without formatting
    
    Usage: {% get_price product.price %}
    """
    request = context.get('request')
    
    if not currency_code and request:
        currency_code = get_user_currency(request)
    elif not currency_code:
        currency_code = 'USD'
    
    if currency_code != 'USD':
        converted_price = convert_price(float(price), currency_code)
    else:
        converted_price = float(price)
    
    return converted_price

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

