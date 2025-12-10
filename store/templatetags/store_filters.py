from django import template
from django.http import QueryDict

register = template.Library()

@register.simple_tag
def remove_param(query_dict, param_name, param_value):
    """
    Удаляет параметр из QueryDict и возвращает URL с параметрами
    Использование: {% remove_param current_params 'size' 'M' %}
    """
    if not query_dict:
        return '?'
    
    try:
        from django.http import QueryDict
        
        # Создаем копию QueryDict
        if isinstance(query_dict, QueryDict):
            params = query_dict.copy()
        else:
            params = QueryDict(query_dict.urlencode() if hasattr(query_dict, 'urlencode') else '')
        
        # Удаляем параметр
        if param_name in params:
            values = params.getlist(param_name)
            param_value_str = str(param_value).strip()
            # Удаляем все вхождения значения
            values = [v for v in values if str(v).strip() != param_value_str]
            if values:
                params.setlist(param_name, values)
            else:
                params.pop(param_name, None)
        
        # Удаляем page при удалении фильтра (чтобы вернуться на первую страницу)
        if 'page' in params:
            params.pop('page')
        
        url = params.urlencode()
        return '?' + url if url else '?'
    except Exception as e:
        # Fallback - возвращаем текущие параметры
        try:
            url = query_dict.urlencode() if hasattr(query_dict, 'urlencode') else ''
            return '?' + url if url else '?'
        except:
            return '?'

@register.filter(name='length_is')
def length_is(value, arg):
    """
    Проверяет, равна ли длина значения указанному числу.
    Используется для совместимости с Django 6.0, где фильтр length_is был удален.
    """
    try:
        return len(value) == int(arg)
    except (TypeError, ValueError):
        return False


