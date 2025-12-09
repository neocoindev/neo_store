from django import template

register = template.Library()

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

