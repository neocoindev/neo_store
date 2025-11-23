#!/usr/bin/env python
"""
Скрипт для генерации Django SECRET_KEY
Использование: python generate_secret_key.py
"""
from django.core.management.utils import get_random_secret_key

if __name__ == '__main__':
    print(get_random_secret_key())

