/**
 * ============================================
 * IMAGE PRELOADER
 * Предзагрузка изображений товаров для мгновенного отображения
 * ============================================
 */

(function() {
    'use strict';

    // Предзагрузка изображений товаров
    function preloadProductImages() {
        const productImages = document.querySelectorAll('.wb-product-image');
        const imageUrls = [];
        
        // Собираем все URL изображений
        productImages.forEach(function(img) {
            if (img.src && img.src !== window.location.href) {
                imageUrls.push(img.src);
            }
        });
        
        // Предзагружаем изображения
        imageUrls.forEach(function(url) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            link.fetchPriority = 'high';
            document.head.appendChild(link);
        });
        
        console.log('Preloaded', imageUrls.length, 'product images');
    }

    // Оптимизация загрузки изображений при скролле
    function optimizeImageLoading() {
        const images = document.querySelectorAll('.wb-product-image');
        
        images.forEach(function(img) {
            // Если изображение уже загружено, показываем его сразу
            if (img.complete) {
                img.style.opacity = '1';
            } else {
                // Обработчик загрузки изображения
                img.addEventListener('load', function() {
                    this.style.opacity = '1';
                    this.classList.add('loaded');
                }, { once: true });
                
                // Обработчик ошибки загрузки
                img.addEventListener('error', function() {
                    this.style.opacity = '1';
                    console.warn('Failed to load image:', this.src);
                }, { once: true });
            }
        });
    }

    // Приоритетная загрузка изображений в viewport
    function prioritizeVisibleImages() {
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.tagName === 'IMG' && !img.complete) {
                        // Устанавливаем высокий приоритет для видимых изображений
                        img.loading = 'eager';
                        if (img.src && !img.dataset.loaded) {
                            img.dataset.loaded = 'true';
                            // Принудительно загружаем изображение
                            const tempImg = new Image();
                            tempImg.src = img.src;
                            tempImg.onload = function() {
                                img.src = this.src;
                            };
                        }
                    }
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '50px' // Начинаем загрузку за 50px до появления в viewport
        });

        // Наблюдаем за всеми изображениями товаров
        document.querySelectorAll('.wb-product-image').forEach(function(img) {
            observer.observe(img);
        });
    }

    // Инициализация при загрузке DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            preloadProductImages();
            optimizeImageLoading();
            prioritizeVisibleImages();
        });
    } else {
        preloadProductImages();
        optimizeImageLoading();
        prioritizeVisibleImages();
    }

    // Предзагрузка при наведении на карточку товара
    document.addEventListener('mouseenter', function(e) {
        const card = e.target.closest('.wb-product-card');
        if (card) {
            const img = card.querySelector('.wb-product-image');
            if (img && !img.complete) {
                // Предзагружаем изображение при наведении
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.as = 'image';
                link.href = img.src;
                document.head.appendChild(link);
            }
        }
    }, true);

})();

