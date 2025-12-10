/**
 * ============================================
 * WILDBERRIES-STYLE MOBILE FILTERS SYSTEM
 * Мобильная система фильтрации в стиле Wildberries
 * ============================================
 */

(function($) {
    'use strict';
    
    // Убеждаемся, что $ доступен глобально
    if (typeof $ === 'undefined' && typeof jQuery !== 'undefined') {
        window.$ = jQuery;
    }

    // ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
    let filterState = {
        categories: [],
        brands: [],
        rating: [],
        sizes: [],
        colors: [],
        priceRange: { min: 0, max: 0 },
        inStock: false,
        isNew: false,
        hasDiscount: false,
        sortBy: '',
        searchQuery: ''
    };

    let filterMetadata = {
        categories: [],
        brands: [],
        sizes: [],
        colors: [],
        priceRange: { min: 0, max: 0 }
    };

    let isMobile = window.innerWidth <= 991;
    let isFilterModalOpen = false;

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    // Используем несколько способов инициализации для надежности
    function initFiltersSystem() {
        // Проверяем наличие jQuery
        if (typeof jQuery === 'undefined' && typeof $ === 'undefined') {
            console.error('jQuery is not loaded! Filters.js requires jQuery.');
            // Пытаемся инициализировать позже
            setTimeout(initFiltersSystem, 500);
            return;
        }
        
        const $ = typeof jQuery !== 'undefined' ? jQuery : window.$;
        
        // Проверяем, что мы на странице магазина или категории
        const isShopPage = window.location.pathname.includes('/shop/') || 
                          window.location.pathname.match(/\/category\/\d+/);
        const isCategoryPage = window.location.pathname.match(/\/category\/(\d+)/);
        
        if (!isShopPage && !isCategoryPage) {
            console.log('Not a shop or category page, filters not initialized', {
                pathname: window.location.pathname
            });
            return;
        }
        
        const productsContainer = $('#products-list').length > 0 ? $('#products-list') : $('.wb-products-grid');
        
        console.log('Initializing filters...', {
            productsContainer: productsContainer.length,
            isMobile: window.innerWidth <= 991,
            windowWidth: window.innerWidth,
            pathname: window.location.pathname,
            jQueryLoaded: typeof $ !== 'undefined'
        });
        
        // Обновляем isMobile перед инициализацией
        isMobile = window.innerWidth <= 991;
        
        // Всегда инициализируем фильтры на странице магазина
        try {
            initializeFilters();
            
            // Загружаем метаданные только если есть контейнер товаров
            if (productsContainer.length > 0) {
                loadFilterMetadata();
                restoreFiltersFromStorage();
            }
            
            updateMobileView();
            
            // Обработка изменения размера окна
            $(window).on('resize', debounce(function() {
                isMobile = window.innerWidth <= 991;
                updateMobileView();
            }, 250));
            
            // Проверяем видимость панели через небольшую задержку
            setTimeout(function() {
                const filterBar = $('#wb-mobile-filter-bar');
                console.log('Filters initialized successfully. Mobile:', isMobile, 
                          'Filter bar exists:', filterBar.length > 0,
                          'Filter bar visible:', filterBar.is(':visible'),
                          'Filter bar display:', filterBar.css('display'));
            }, 300);
        } catch (error) {
            console.error('Error initializing filters:', error);
        }
    }
    
    // Оптимизированная инициализация - только один раз
    let initFiltersSystemCalled = false;
    function initFiltersSystemOnce() {
        if (initFiltersSystemCalled) return;
        initFiltersSystemCalled = true;
        
        // Используем requestIdleCallback для мобильных устройств для лучшей производительности
        if ('requestIdleCallback' in window && window.innerWidth <= 991) {
            requestIdleCallback(function() {
                initFiltersSystem();
            }, { timeout: 1000 });
        } else {
            // Для desktop или если requestIdleCallback не поддерживается
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', function() {
                    initFiltersSystem();
                }, { once: true });
            } else {
                // DOM уже загружен - используем setTimeout для неблокирующей инициализации
                setTimeout(initFiltersSystem, 0);
            }
        }
    }
    
    // Инициализация при загрузке DOM (только один раз)
    initFiltersSystemOnce();

    // ========== ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ ==========
    function initializeFilters() {
        // Мобильная верхняя панель фильтров
        createMobileFilterBar();
        
        // Bottom sheet модальное окно
        createFilterModal();
        
        // Обработчики событий
        setupEventHandlers();
        
        // Восстановление из URL
        restoreFiltersFromURL();
    }

    // ========== СОЗДАНИЕ МОБИЛЬНОЙ ПАНЕЛИ ФИЛЬТРОВ ==========
    function createMobileFilterBar() {
        if ($('#wb-mobile-filter-bar').length === 0) {
            console.log('Creating mobile filter bar...');
            const filterBar = $(`
                <div id="wb-mobile-filter-bar" class="wb-mobile-filter-bar">
                    <div class="wb-filter-scroll">
                        <button class="wb-filter-chip-btn" data-filter="categories">
                            <i class="fas fa-th-large"></i> Категории
                        </button>
                        <button class="wb-filter-chip-btn" data-filter="price">
                            <i class="fas fa-dollar-sign"></i> Цена
                        </button>
                        <button class="wb-filter-chip-btn" data-filter="rating">
                            <i class="fas fa-star"></i> Рейтинг
                        </button>
                        <button class="wb-filter-chip-btn" data-filter="size">
                            <i class="fas fa-ruler"></i> Размер
                        </button>
                        <button class="wb-filter-chip-btn" data-filter="color">
                            <i class="fas fa-palette"></i> Цвет
                        </button>
                        <button class="wb-filter-chip-btn" data-filter="brand">
                            <i class="fas fa-tag"></i> Бренд
                        </button>
                        <button class="wb-filter-chip-btn" data-filter="sort">
                            <i class="fas fa-sort"></i> Сортировка
                        </button>
                    </div>
                </div>
            `);
            
            // Вставляем после секции поиска или перед товарами
            const searchSection = $('.wb-filters-section');
            const productsContainer = $('#products-list').closest('.col-lg-9, .row');
            const container = $('.container').first();
            const middleSection = $('section.middle');
            
            if (searchSection.length > 0) {
                searchSection.after(filterBar);
                console.log('Filter bar inserted after search section');
            } else if (productsContainer.length > 0) {
                productsContainer.before(filterBar);
                console.log('Filter bar inserted before products container');
            } else if (container.length > 0) {
                const firstRow = container.find('.row').first();
                if (firstRow.length > 0) {
                    firstRow.before(filterBar);
                    console.log('Filter bar inserted before first row');
                } else {
                    container.prepend(filterBar);
                    console.log('Filter bar prepended to container');
                }
            } else if (middleSection.length > 0) {
                middleSection.prepend(filterBar);
                console.log('Filter bar prepended to middle section');
            } else {
                $('body').prepend(filterBar);
                console.log('Filter bar prepended to body (fallback)');
            }
            
            // Принудительно показываем на мобильных устройствах
            // Проверяем размер экрана еще раз
            const currentIsMobile = window.innerWidth <= 991;
            if (currentIsMobile) {
                filterBar.show().css({
                    'display': 'block',
                    'visibility': 'visible',
                    'opacity': '1'
                });
                console.log('Mobile filter bar shown, buttons count:', filterBar.find('.wb-filter-chip-btn').length);
            } else {
                filterBar.hide();
                console.log('Mobile filter bar hidden (desktop)');
            }
            
            // Тестируем клики
            filterBar.find('.wb-filter-chip-btn').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Filter button clicked directly:', $(this).data('filter'));
                const filterType = $(this).data('filter');
                openFilterModal(filterType);
            });
        } else {
            console.log('Mobile filter bar already exists');
        }
    }

    // ========== СОЗДАНИЕ МОДАЛЬНОГО ОКНА ФИЛЬТРОВ ==========
    function createFilterModal() {
        if ($('#wb-filter-modal').length === 0) {
            const modal = $(`
                <div id="wb-filter-modal" class="wb-filter-modal">
                    <div class="wb-filter-modal-backdrop"></div>
                    <div class="wb-filter-modal-content">
                        <div class="wb-filter-modal-header">
                            <h3>Фильтры</h3>
                            <button class="wb-filter-modal-close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="wb-filter-modal-body">
                            <div id="wb-filter-content"></div>
                        </div>
                        <div class="wb-filter-modal-footer">
                            <button class="wb-filter-reset-btn">Сбросить</button>
                            <button class="wb-filter-apply-btn">Показать <span id="wb-filter-count">0</span> товаров</button>
                        </div>
                    </div>
                </div>
            `);
            
            $('body').append(modal);
        }
    }

    // ========== НАСТРОЙКА ОБРАБОТЧИКОВ СОБЫТИЙ ==========
    function setupEventHandlers() {
        const $ = typeof jQuery !== 'undefined' ? jQuery : window.$;
        
        console.log('Setting up event handlers...');
        
        // Удаляем старые обработчики, если они есть
        $(document).off('click', '.wb-filter-chip-btn');
        $(document).off('click', '.wb-filter-modal-close, .wb-filter-modal-backdrop');
        $(document).off('click', '.wb-filter-apply-btn');
        $(document).off('click', '.wb-filter-reset-btn');
        $(document).off('change', '.wb-filter-checkbox, .wb-filter-radio, .wb-filter-range');
        $(document).off('input', '#wb-price-range-min, #wb-price-range-max');
        
        // Открытие модального окна при клике на кнопку фильтра
        $(document).on('click', '.wb-filter-chip-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const filterType = $(this).data('filter');
            console.log('Filter chip clicked (delegated):', filterType, $(this));
            openFilterModal(filterType);
            return false;
        });

        // Закрытие модального окна
        $(document).on('click', '.wb-filter-modal-close, .wb-filter-modal-backdrop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Closing filter modal');
            closeFilterModal();
        });

        // Применение фильтров
        $(document).on('click', '.wb-filter-apply-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Apply filters button clicked');
            applyFilters();
            closeFilterModal();
        });

        // Сброс фильтров
        $(document).on('click', '.wb-filter-reset-btn', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Reset filters button clicked');
            resetFilters();
        });

        // Обработка изменений в фильтрах
        $(document).on('change', '.wb-filter-checkbox, .wb-filter-radio, .wb-filter-range', function() {
            console.log('Filter changed:', $(this).data('filter'), $(this).data('value'));
            updateFilterState();
            
            // Автоматически применяем фильтры при изменении (как в desktop версии)
            // Но только если модальное окно открыто (чтобы не применять при закрытии)
            if ($('#wb-filter-modal').hasClass('active')) {
                // Обновляем счетчик товаров
                updateFilterCount();
            }
        });

        // Обработка слайдера цены
        let priceInputTimeout;
        $(document).on('input', '#wb-price-range-min, #wb-price-range-max', function() {
            console.log('Price range changed');
            clearTimeout(priceInputTimeout);
            updatePriceRange();
            
            // Обновляем счетчик с задержкой (debounce)
            if ($('#wb-filter-modal').hasClass('active')) {
                priceInputTimeout = setTimeout(function() {
                    updateFilterCount();
                }, 500);
            }
        });
        
        console.log('Event handlers set up successfully');
    }

    // ========== ОТКРЫТИЕ МОДАЛЬНОГО ОКНА ==========
    function openFilterModal(filterType) {
        console.log('Opening filter modal for type:', filterType);
        isFilterModalOpen = true;
        const modal = $('#wb-filter-modal');
        const content = $('#wb-filter-content');
        
        if (modal.length === 0) {
            console.error('Filter modal not found!');
            return;
        }
        
        if (content.length === 0) {
            console.error('Filter content container not found!');
            return;
        }
        
        // ВАЖНО: Синхронизируем состояние фильтров из desktop формы ПЕРЕД генерацией HTML
        // Это нужно, чтобы функции генерации использовали правильные значения из filterState
        const categoryFilterForm = document.getElementById('category-filters-form');
        const shopFilterForm = document.getElementById('shop-filters-form');
        
        if (categoryFilterForm) {
            syncFormToMobileFilters(categoryFilterForm);
        } else if (shopFilterForm) {
            // Для shop страницы синхронизируем из shop формы
            syncShopFormToMobileFilters(shopFilterForm);
        }
        
        // Генерируем контент в зависимости от типа фильтра (теперь с правильными значениями)
        let html = '';
        
        switch(filterType) {
            case 'categories':
                html = generateCategoriesFilter();
                break;
            case 'price':
                html = generatePriceFilter();
                break;
            case 'rating':
                html = generateRatingFilter();
                break;
            case 'size':
                html = generateSizeFilter();
                break;
            case 'color':
                html = generateColorFilter();
                break;
            case 'brand':
                html = generateBrandFilter();
                break;
            case 'sort':
                html = generateSortFilter();
                break;
            default:
                console.error('Unknown filter type:', filterType);
                return;
        }
        
        content.html(html);
        modal.addClass('active').show();
        $('body').addClass('modal-open');
        
        console.log('Modal opened, content length:', html.length);
        
        // Обновляем счетчик товаров после открытия модального окна
        // Используем requestAnimationFrame для оптимизации на мобильных
        if (window.requestAnimationFrame) {
            requestAnimationFrame(function() {
                updateFilterCount();
            });
        } else {
            setTimeout(function() {
                updateFilterCount();
            }, 50);
        }
    }

    // ========== ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА ==========
    function closeFilterModal() {
        isFilterModalOpen = false;
        $('#wb-filter-modal').removeClass('active');
        $('body').removeClass('modal-open');
    }

    // ========== ГЕНЕРАЦИЯ ФИЛЬТРОВ ==========
    function generateCategoriesFilter() {
        // Используем данные из DOM, если метаданные еще не загружены
        let categories = filterMetadata.categories;
        if (!categories || categories.length === 0) {
            categories = [];
            $('.category-filter').each(function() {
                const $input = $(this);
                const id = parseInt($input.val());
                const title = $input.closest('label').find('.wb-filter-label').text() || 
                             $input.next('label').text() || 
                             $input.closest('.form-check').find('label').text();
                const count = $input.closest('label').find('.wb-filter-count').text().replace(/[()]/g, '') || '0';
                if (id && title) {
                    categories.push({
                        id: id,
                        title: title.trim(),
                        count: parseInt(count) || 0
                    });
                }
            });
        }
        
        if (categories.length === 0) {
            return '<div class="wb-filter-empty"><div class="wb-filter-empty-text">Категории не найдены</div></div>';
        }
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Категории</h4>';
        html += '<div class="wb-filter-list">';
        
        categories.forEach(function(cat) {
            const isChecked = filterState.categories.includes(cat.id);
            html += `
                <label class="wb-filter-item">
                    <input type="checkbox" class="wb-filter-checkbox" 
                           data-filter="categories" data-value="${cat.id}" 
                           name="category[]"
                           value="${cat.id}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="wb-filter-label">${cat.title || 'Категория'}</span>
                    <span class="wb-filter-count">(${cat.count || 0})</span>
                </label>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    function generatePriceFilter() {
        const priceMin = (filterMetadata.priceRange && filterMetadata.priceRange.min) ? filterMetadata.priceRange.min : 0;
        const priceMax = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
        const minPrice = filterState.priceRange.min || priceMin;
        const maxPrice = filterState.priceRange.max || priceMax;
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Цена</h4>';
        html += '<div class="wb-price-filter">';
        html += `<div class="wb-price-inputs">
            <input type="number" id="wb-price-range-min" class="wb-filter-range" 
                   name="price_min"
                   placeholder="От" value="${minPrice}" min="${priceMin}" max="${priceMax}">
            <span>-</span>
            <input type="number" id="wb-price-range-max" class="wb-filter-range" 
                   name="price_max"
                   placeholder="До" value="${maxPrice}" min="${priceMin}" max="${priceMax}">
        </div>`;
        html += '</div></div>';
        return html;
    }

    function generateRatingFilter() {
        const ratings = [
            { value: 5, label: '5★', text: '5 звезд' },
            { value: 4, label: '4★+', text: '4 звезды и выше' },
            { value: 3, label: '3★+', text: '3 звезды и выше' },
            { value: 2, label: '2★+', text: '2 звезды и выше' },
            { value: 1, label: '1★+', text: '1 звезда и выше' }
        ];
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Рейтинг</h4>';
        html += '<div class="wb-filter-list">';
        
        ratings.forEach(function(rating) {
            const isChecked = filterState.rating.includes(rating.value);
            html += `
                <label class="wb-filter-item">
                    <input type="radio" name="rating" class="wb-filter-radio" 
                           data-filter="rating" data-value="${rating.value}" 
                           ${isChecked ? 'checked' : ''}>
                    <span class="wb-filter-label">${rating.label} ${rating.text}</span>
                </label>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    function generateSizeFilter() {
        // Используем данные из DOM, если метаданные еще не загружены
        let sizes = filterMetadata.sizes;
        if (!sizes || sizes.length === 0) {
            sizes = [];
            $('.size-filter').each(function() {
                const $input = $(this);
                const name = $input.val();
                const title = $input.closest('label').find('.wb-size-label').text() || 
                             $input.next('label').text() || 
                             $input.closest('.form-check').find('label').text();
                if (name) {
                    sizes.push({
                        name: name,
                        title: title.trim() || name,
                        count: 0
                    });
                }
            });
        }
        
        if (sizes.length === 0) {
            return '<div class="wb-filter-empty"><div class="wb-filter-empty-text">Размеры не найдены</div></div>';
        }
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Размер</h4>';
        html += '<div class="wb-size-grid">';
        
        sizes.forEach(function(size) {
            const isChecked = filterState.sizes.includes(size.name);
            html += `
                <label class="wb-size-item ${isChecked ? 'active' : ''}">
                    <input type="checkbox" class="wb-filter-checkbox" 
                           data-filter="sizes" data-value="${size.name}" 
                           name="size[]"
                           value="${size.name}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="wb-size-label">${size.title || size.name}</span>
                    ${size.count ? `<span class="wb-size-count">${size.count}</span>` : ''}
                </label>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    function generateColorFilter() {
        // Используем данные из DOM, если метаданные еще не загружены
        let colors = filterMetadata.colors;
        if (!colors || colors.length === 0) {
            colors = [];
            $('.colors-filter').each(function() {
                const $input = $(this);
                const name = $input.val();
                const $label = $input.closest('label');
                const colorCode = $label.css('background-color') || $label.attr('style')?.match(/background-color:\s*([^;]+)/)?.[1] || name;
                const title = $label.find('.wb-color-name').text() || name;
                if (name) {
                    colors.push({
                        name: name,
                        display_name: title,
                        code: colorCode
                    });
                }
            });
        }
        
        if (colors.length === 0) {
            return '<div class="wb-filter-empty"><div class="wb-filter-empty-text">Цвета не найдены</div></div>';
        }
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Цвет</h4>';
        html += '<div class="wb-color-grid">';
        
        colors.forEach(function(color) {
            const isChecked = filterState.colors.includes(color.name);
            const colorCode = color.code || color.name;
            html += `
                <label class="wb-color-item ${isChecked ? 'active' : ''}" 
                       style="background-color: ${colorCode};">
                    <input type="checkbox" class="wb-filter-checkbox" 
                           data-filter="colors" data-value="${color.name}" 
                           name="color[]"
                           value="${color.name}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="wb-color-name">${color.display_name || color.name}</span>
                </label>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    function generateBrandFilter() {
        // Используем данные из DOM, если метаданные еще не загружены
        let brands = filterMetadata.brands;
        if (!brands || brands.length === 0) {
            brands = [];
            $('.brand-filter').each(function() {
                const $input = $(this);
                const name = $input.val();
                const title = $input.closest('label').find('.wb-filter-label').text() || name;
                const count = $input.closest('label').find('.wb-filter-count').text().replace(/[()]/g, '') || '0';
                if (name) {
                    brands.push({
                        name: name,
                        count: parseInt(count) || 0
                    });
                }
            });
        }
        
        if (brands.length === 0) {
            return '<div class="wb-filter-empty"><div class="wb-filter-empty-text">Бренды не найдены</div></div>';
        }
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Бренд</h4>';
        html += '<div class="wb-filter-list">';
        
        brands.forEach(function(brand) {
            const isChecked = filterState.brands.includes(brand.name);
            html += `
                <label class="wb-filter-item">
                    <input type="checkbox" class="wb-filter-checkbox" 
                           data-filter="brands" data-value="${brand.name}" 
                           name="brand[]"
                           value="${brand.name}"
                           ${isChecked ? 'checked' : ''}>
                    <span class="wb-filter-label">${brand.name}</span>
                    <span class="wb-filter-count">(${brand.count || 0})</span>
                </label>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    function generateSortFilter() {
        const sortOptions = [
            { value: '', label: 'По умолчанию' },
            { value: 'highest', label: 'Цена: от низкой к высокой' },
            { value: 'lowest', label: 'Цена: от высокой к низкой' },
            { value: 'rating', label: 'По рейтингу' },
            { value: 'popular', label: 'По популярности' }
        ];
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Сортировка</h4>';
        html += '<div class="wb-filter-list">';
        
        sortOptions.forEach(function(option) {
            const isChecked = filterState.sortBy === option.value;
            html += `
                <label class="wb-filter-item">
                    <input type="radio" name="sort" class="wb-filter-radio" 
                           data-filter="sort" data-value="${option.value}" 
                           ${isChecked ? 'checked' : ''}>
                    <span class="wb-filter-label">${option.label}</span>
                </label>
            `;
        });
        
        html += '</div></div>';
        return html;
    }

    // ========== ОБНОВЛЕНИЕ СОСТОЯНИЯ ФИЛЬТРОВ ==========
    function updateFilterState() {
        filterState.categories = [];
        filterState.brands = [];
        filterState.rating = [];
        filterState.sizes = [];
        filterState.colors = [];
        filterState.seasons = [];
        filterState.materials = [];
        filterState.sortBy = '';
        filterState.sale = false;
        
        // Собираем данные ТОЛЬКО из модального окна (чтобы не конфликтовать с desktop версией)
        const modal = $('#wb-filter-modal');
        
        modal.find('.wb-filter-checkbox[data-filter="categories"]:checked').each(function() {
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.categories.push(parseInt(value));
        });
        
        modal.find('.wb-filter-checkbox[data-filter="brands"]:checked').each(function() {
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.brands.push(value);
        });
        
        modal.find('.wb-filter-radio[data-filter="rating"]:checked').each(function() {
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.rating.push(value);
        });
        
        modal.find('.wb-filter-checkbox[data-filter="sizes"]:checked').each(function() {
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.sizes.push(value);
        });
        
        modal.find('.wb-filter-checkbox[data-filter="colors"]:checked').each(function() {
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.colors.push(value);
        });
        
        modal.find('.wb-filter-checkbox[data-filter="seasons"]:checked').each(function() {
            if (!filterState.seasons) filterState.seasons = [];
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.seasons.push(value);
        });
        
        modal.find('.wb-filter-checkbox[data-filter="materials"]:checked').each(function() {
            if (!filterState.materials) filterState.materials = [];
            const value = $(this).data('value') || $(this).val();
            if (value) filterState.materials.push(value);
        });
        
        modal.find('.wb-filter-checkbox[data-filter="sale"]:checked').each(function() {
            filterState.sale = true;
        });
        
        const sortRadio = modal.find('.wb-filter-radio[data-filter="sort"]:checked');
        if (sortRadio.length > 0) {
            filterState.sortBy = sortRadio.data('value') || sortRadio.val();
        }
        
        // Обновляем цену из модального окна
        const minPrice = parseFloat(modal.find('#wb-price-range-min').val()) || 0;
        const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
        const maxPrice = parseFloat(modal.find('#wb-price-range-max').val()) || defaultMaxPrice;
        filterState.priceRange = { min: minPrice, max: maxPrice };
        
        // Сохраняем в localStorage
        saveFiltersToStorage();
    }

    function updatePriceRange() {
        const minPrice = parseFloat($('#wb-price-range-min').val()) || 0;
        const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
        const maxPrice = parseFloat($('#wb-price-range-max').val()) || defaultMaxPrice;
        
        filterState.priceRange = { min: minPrice, max: maxPrice };
        saveFiltersToStorage();
    }

    // ========== ПРИМЕНЕНИЕ ФИЛЬТРОВ ==========
    function applyFilters() {
        console.log('=== applyFilters called ===');
        
        // Сначала обновляем состояние фильтров из модального окна
        updateFilterState();
        console.log('Filter state after update:', filterState);
        
        // Проверяем, есть ли desktop версия фильтров (для страницы категории или shop)
        const categoryFilterForm = document.getElementById('category-filters-form');
        const shopFilterForm = document.getElementById('shop-filters-form');
        const categoryId = window.categoryId || (window.location.pathname.match(/\/category\/(\d+)/) ? window.location.pathname.match(/\/category\/(\d+)/)[1] : null);
        const isShopPage = window.location.pathname.includes('/shop/');
        
        // Для страницы категории
        if (categoryFilterForm && categoryId) {
            console.log('Category filter form found, categoryId:', categoryId);
            
            // Используем desktop версию фильтров - синхронизируем мобильные значения с формой
            syncMobileFiltersToForm(categoryFilterForm);
            
            // Проверяем доступность desktop функций
            console.log('Checking desktop functions:', {
                loadProducts: typeof window.loadProducts,
                getFormParams: typeof window.getFormParams,
                categoryId: window.categoryId
            });
            
            // Используем desktop функции, если они доступны
            if (typeof window.loadProducts === 'function' && typeof window.getFormParams === 'function') {
                console.log('Using desktop functions for filtering');
                const params = window.getFormParams(categoryFilterForm);
                console.log('Form params:', params.toString());
                
                // Закрываем модальное окно перед применением фильтров
                closeFilterModal();
                
                // Применяем фильтры через desktop функцию
                try {
                    window.loadProducts(params, 1);
                    console.log('loadProducts called successfully');
                } catch (e) {
                    console.error('Error calling loadProducts:', e);
                    alert('Ошибка при применении фильтров. Пожалуйста, попробуйте еще раз.');
                }
                return;
            } else {
                console.warn('Desktop functions not available, using fallback');
            }
        }
        
        // Для shop страницы или если desktop функции недоступны
        console.log('Using fallback filter request', {
            isShopPage: isShopPage,
            hasShopForm: !!shopFilterForm
        });
        
        // Закрываем модальное окно перед применением фильтров
        closeFilterModal();
        
        // Используем makeFilterRequest для shop страницы
        makeFilterRequest();
        updateURL();
        updateActiveFilters();
    }
    
    // Синхронизация мобильных фильтров с desktop формой
    function syncMobileFiltersToForm(form) {
        console.log('Syncing mobile filters to form, filterState:', filterState);
        
        // Синхронизируем категории
        const categoryCheckboxes = form.querySelectorAll('input[name="category[]"]');
        categoryCheckboxes.forEach(function(cb) {
            const value = parseInt(cb.value);
            cb.checked = filterState.categories.includes(value);
        });
        
        // Синхронизируем размеры
        const sizeCheckboxes = form.querySelectorAll('input[name="size[]"]');
        sizeCheckboxes.forEach(function(cb) {
            cb.checked = filterState.sizes.includes(cb.value);
        });
        
        // Синхронизируем цвета
        const colorCheckboxes = form.querySelectorAll('input[name="color[]"]');
        colorCheckboxes.forEach(function(cb) {
            cb.checked = filterState.colors.includes(cb.value);
        });
        
        // Синхронизируем бренды
        const brandCheckboxes = form.querySelectorAll('input[name="brand[]"]');
        brandCheckboxes.forEach(function(cb) {
            cb.checked = filterState.brands.includes(cb.value);
        });
        
        // Синхронизируем цену
        const priceMinInput = form.querySelector('input[name="price_min"]');
        const priceMaxInput = form.querySelector('input[name="price_max"]');
        if (priceMinInput) {
            if (filterState.priceRange.min > 0) {
                priceMinInput.value = filterState.priceRange.min;
            } else {
                priceMinInput.value = '';
            }
        }
        if (priceMaxInput) {
            const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
            if (filterState.priceRange.max < defaultMaxPrice) {
                priceMaxInput.value = filterState.priceRange.max;
            } else {
                priceMaxInput.value = '';
            }
        }
        
        // Синхронизируем сезоны
        const seasonCheckboxes = form.querySelectorAll('input[name="season[]"]');
        if (seasonCheckboxes.length > 0 && filterState.seasons && filterState.seasons.length > 0) {
            seasonCheckboxes.forEach(function(cb) {
                cb.checked = filterState.seasons.includes(cb.value);
            });
        } else if (seasonCheckboxes.length > 0) {
            seasonCheckboxes.forEach(function(cb) {
                cb.checked = false;
            });
        }
        
        // Синхронизируем материалы
        const materialCheckboxes = form.querySelectorAll('input[name="material[]"]');
        if (materialCheckboxes.length > 0 && filterState.materials && filterState.materials.length > 0) {
            materialCheckboxes.forEach(function(cb) {
                cb.checked = filterState.materials.includes(cb.value);
            });
        } else if (materialCheckboxes.length > 0) {
            materialCheckboxes.forEach(function(cb) {
                cb.checked = false;
            });
        }
        
        // Синхронизируем распродажу
        const saleCheckbox = form.querySelector('input[name="sale"]');
        if (saleCheckbox) {
            saleCheckbox.checked = filterState.sale || false;
        }
        
        console.log('Form synced. Category checkboxes checked:', form.querySelectorAll('input[name="category[]"]:checked').length);
    }
    
    // Синхронизация desktop формы с мобильными фильтрами (при открытии модального окна)
    function syncFormToMobileFilters(form) {
        console.log('Syncing form to mobile filters');
        
        // Синхронизируем категории
        const categoryCheckboxes = form.querySelectorAll('input[name="category[]"]:checked');
        filterState.categories = [];
        categoryCheckboxes.forEach(function(cb) {
            const value = parseInt(cb.value);
            if (value) filterState.categories.push(value);
        });
        
        // Синхронизируем размеры
        const sizeCheckboxes = form.querySelectorAll('input[name="size[]"]:checked');
        filterState.sizes = [];
        sizeCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.sizes.push(cb.value);
        });
        
        // Синхронизируем цвета
        const colorCheckboxes = form.querySelectorAll('input[name="color[]"]:checked');
        filterState.colors = [];
        colorCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.colors.push(cb.value);
        });
        
        // Синхронизируем бренды
        const brandCheckboxes = form.querySelectorAll('input[name="brand[]"]:checked');
        filterState.brands = [];
        brandCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.brands.push(cb.value);
        });
        
        // Синхронизируем цену
        const priceMinInput = form.querySelector('input[name="price_min"]');
        const priceMaxInput = form.querySelector('input[name="price_max"]');
        if (priceMinInput && priceMinInput.value) {
            filterState.priceRange.min = parseFloat(priceMinInput.value) || 0;
        } else {
            filterState.priceRange.min = 0;
        }
        if (priceMaxInput && priceMaxInput.value) {
            const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
            filterState.priceRange.max = parseFloat(priceMaxInput.value) || defaultMaxPrice;
        } else {
            const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
            filterState.priceRange.max = defaultMaxPrice;
        }
        
        // Синхронизируем сезоны
        const seasonCheckboxes = form.querySelectorAll('input[name="season[]"]:checked');
        filterState.seasons = [];
        seasonCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.seasons.push(cb.value);
        });
        
        // Синхронизируем материалы
        const materialCheckboxes = form.querySelectorAll('input[name="material[]"]:checked');
        filterState.materials = [];
        materialCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.materials.push(cb.value);
        });
        
        // Синхронизируем распродажу
        const saleCheckbox = form.querySelector('input[name="sale"]:checked');
        filterState.sale = saleCheckbox ? true : false;
        
        // Сохраняем в localStorage
        saveFiltersToStorage();
        
        console.log('Mobile filters synced from form:', filterState);
    }
    
    // Синхронизация shop формы с мобильными фильтрами (для страницы shop)
    function syncShopFormToMobileFilters(form) {
        console.log('Syncing shop form to mobile filters');
        
        // Синхронизируем категории (shop использует categories[])
        const categoryCheckboxes = form.querySelectorAll('input[name="categories[]"]:checked');
        filterState.categories = [];
        categoryCheckboxes.forEach(function(cb) {
            const value = parseInt(cb.value);
            if (value) filterState.categories.push(value);
        });
        
        // Синхронизируем размеры (shop использует sizes[])
        const sizeCheckboxes = form.querySelectorAll('input[name="sizes[]"]:checked');
        filterState.sizes = [];
        sizeCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.sizes.push(cb.value);
        });
        
        // Синхронизируем цвета (shop использует colors[])
        const colorCheckboxes = form.querySelectorAll('input[name="colors[]"]:checked');
        filterState.colors = [];
        colorCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.colors.push(cb.value);
        });
        
        // Синхронизируем бренды (shop использует brands[])
        const brandCheckboxes = form.querySelectorAll('input[name="brands[]"]:checked');
        filterState.brands = [];
        brandCheckboxes.forEach(function(cb) {
            if (cb.value) filterState.brands.push(cb.value);
        });
        
        // Синхронизируем рейтинг (shop использует rating[])
        const ratingCheckboxes = form.querySelectorAll('input[name="rating[]"]:checked');
        filterState.rating = [];
        ratingCheckboxes.forEach(function(cb) {
            const value = parseInt(cb.value);
            if (value) filterState.rating.push(value);
        });
        
        // Синхронизируем цену (shop использует min_price и max_price)
        const priceMinInput = form.querySelector('input[name="min_price"]');
        const priceMaxInput = form.querySelector('input[name="max_price"]');
        if (priceMinInput && priceMinInput.value) {
            filterState.priceRange.min = parseFloat(priceMinInput.value) || 0;
        } else {
            filterState.priceRange.min = 0;
        }
        if (priceMaxInput && priceMaxInput.value) {
            const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
            filterState.priceRange.max = parseFloat(priceMaxInput.value) || defaultMaxPrice;
        } else {
            const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
            filterState.priceRange.max = defaultMaxPrice;
        }
        
        // Синхронизируем сортировку (shop использует prices)
        const sortInput = form.querySelector('input[name="prices"]:checked');
        if (sortInput && sortInput.value) {
            filterState.sortBy = sortInput.value;
        } else {
            filterState.sortBy = '';
        }
        
        // Сохраняем в localStorage
        saveFiltersToStorage();
        
        console.log('Mobile filters synced from shop form:', filterState);
    }

    function makeFilterRequest() {
        const ajaxData = {};
        
        // Определяем, на какой странице мы находимся
        const isCategoryPage = window.location.pathname.match(/\/category\/(\d+)/);
        const categoryId = isCategoryPage ? isCategoryPage[1] : null;
        
        // Формируем параметры в правильном формате
        if (filterState.categories.length > 0) {
            // Для страницы категории используем 'category', для shop - 'categories[]'
            if (categoryId) {
                // Для категории передаем массив значений
                filterState.categories.forEach(function(catId) {
                    if (!ajaxData['category']) {
                        ajaxData['category'] = [];
                    }
                    if (Array.isArray(ajaxData['category'])) {
                        ajaxData['category'].push(catId);
                    } else {
                        ajaxData['category'] = [ajaxData['category'], catId];
                    }
                });
            } else {
                ajaxData['categories[]'] = filterState.categories;
            }
        }
        if (filterState.brands.length > 0) {
            filterState.brands.forEach(function(brand) {
                ajaxData['brand'] = (ajaxData['brand'] || []).concat([brand]);
            });
        }
        if (filterState.sizes.length > 0) {
            filterState.sizes.forEach(function(size) {
                ajaxData['size'] = (ajaxData['size'] || []).concat([size]);
            });
        }
        if (filterState.colors.length > 0) {
            filterState.colors.forEach(function(color) {
                ajaxData['color'] = (ajaxData['color'] || []).concat([color]);
            });
        }
        if (filterState.priceRange.min > 0) {
            ajaxData['price_min'] = filterState.priceRange.min;
        }
        const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
        if (filterState.priceRange.max < defaultMaxPrice) {
            ajaxData['price_max'] = filterState.priceRange.max;
        }
        if (filterState.sortBy) {
            ajaxData['sort'] = filterState.sortBy;
        }
        if (filterState.searchQuery) {
            ajaxData['q'] = filterState.searchQuery;
        }
        
        ajaxData['page'] = 1;
        
        console.log('Sending filter request:', ajaxData);
        
        // Определяем правильный URL для запроса
        let requestUrl;
        if (categoryId) {
            // Используем AJAX endpoint для категории
            requestUrl = `/category/${categoryId}/filter/`;
        } else {
            // Используем endpoint для shop
            requestUrl = "/filter_products/";
            ajaxData['per_page'] = 20;
        }
        
        // Проверяем кэш для мобильных устройств
        const isMobile = window.innerWidth <= 991;
        const cacheKey = requestUrl + JSON.stringify(ajaxData);
        if (isMobile) {
            const cached = getCachedResponse(cacheKey);
            if (cached) {
                handleFilterResponse(cached, categoryId);
                return;
            }
        }
        
        // Показываем индикатор загрузки
        const productsContainer = $("#products-list");
        if (productsContainer.length > 0) {
            productsContainer.prepend('<div class="wb-filter-loading"><div class="wb-filter-loading-spinner"></div></div>');
            productsContainer.css('opacity', '0.5');
        }
        
        $.ajax({
            url: requestUrl,
            method: "GET",
            data: ajaxData,
            traditional: true,
            success: function(response) {
                // Кэшируем результат для мобильных устройств
                if (isMobile) {
                    setCachedResponse(cacheKey, response);
                }
                handleFilterResponse(response, categoryId);
            },
            error: function(xhr, status, error) {
                console.error("Ошибка при применении фильтров:", error, xhr);
                if (productsContainer.length > 0) {
                    productsContainer.find('.wb-filter-loading').remove();
                    productsContainer.css('opacity', '1');
                }
                alert('Произошла ошибка при применении фильтров. Пожалуйста, попробуйте еще раз.');
            }
        });
    }
    
    // Функция для обработки ответа фильтрации (оптимизирована)
    function handleFilterResponse(response, categoryId) {
        const productsContainer = $("#products-list");
        
        if (categoryId && response.success) {
            // Обработка ответа для страницы категории
            if (productsContainer.length > 0) {
                productsContainer.find('.wb-filter-loading').remove();
                productsContainer.html(response.products_html);
                productsContainer.css('opacity', '1');
            }
            if (response.filters_html) {
                $('#active-filters-container-top').html(response.filters_html);
            }
            if (response.pagination_html) {
                $('#pagination-container').html(response.pagination_html);
            }
            if (response.product_count !== undefined) {
                $('#product-count').text(response.product_count);
            }
            if (response.update_url) {
                window.history.pushState({}, '', response.update_url);
            }
        } else if (!categoryId && response.html) {
            // Обработка ответа для shop страницы
            if (productsContainer.length > 0) {
                productsContainer.find('.wb-filter-loading').remove();
                productsContainer.html(response.html);
                productsContainer.css('opacity', '1');
            }
            if (response.product_count !== undefined) {
                $(".product_count").text(response.product_count);
            }
        }
    }

    // ========== СБРОС ФИЛЬТРОВ ==========
    function resetFilters() {
        filterState = {
            categories: [],
            brands: [],
            rating: [],
            sizes: [],
            colors: [],
            priceRange: { min: 0, max: 0 },
            inStock: false,
            isNew: false,
            hasDiscount: false,
            sortBy: '',
            searchQuery: ''
        };
        
        $('.wb-filter-checkbox, .wb-filter-radio').prop('checked', false);
        const defaultMinPrice = (filterMetadata.priceRange && filterMetadata.priceRange.min) ? filterMetadata.priceRange.min : 0;
        const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
        $('#wb-price-range-min').val(defaultMinPrice);
        $('#wb-price-range-max').val(defaultMaxPrice);
        
        saveFiltersToStorage();
        applyFilters();
    }

    // ========== ОБНОВЛЕНИЕ СЧЕТЧИКА ТОВАРОВ ==========
    function updateFilterCount() {
        console.log('updateFilterCount called');
        
        // Обновляем состояние фильтров перед подсчетом
        updateFilterState();
        console.log('Filter state after update:', filterState);
        
        // Проверяем, есть ли desktop версия (для страницы категории или shop)
        const categoryFilterForm = document.getElementById('category-filters-form');
        const shopFilterForm = document.getElementById('shop-filters-form');
        const categoryId = window.categoryId || (window.location.pathname.match(/\/category\/(\d+)/) ? window.location.pathname.match(/\/category\/(\d+)/)[1] : null);
        const isShopPage = window.location.pathname.includes('/shop/');
        
        // Для страницы категории
        if (categoryFilterForm && typeof window.getFormParams === 'function' && categoryId) {
            console.log('Using category desktop form for count update');
            
            // Синхронизируем мобильные фильтры с формой
            syncMobileFiltersToForm(categoryFilterForm);
            
            // Получаем параметры из формы
            const params = window.getFormParams(categoryFilterForm);
            console.log('Form params for count:', params.toString());
            
            // Делаем быстрый AJAX запрос только для получения количества
            const xhr = new XMLHttpRequest();
            xhr.open('GET', `/category/${categoryId}/filter/?${params.toString()}`, true);
            xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            
            xhr.onload = function() {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        console.log('Count response:', data);
                        if (data.success && data.product_count !== undefined) {
                            $('#wb-filter-count').text(data.product_count);
                            console.log('Count updated to:', data.product_count);
                        } else {
                            console.warn('No product_count in response');
                            $('#wb-filter-count').text('0');
                        }
                    } catch (e) {
                        console.error('Error parsing count response:', e, xhr.responseText);
                        $('#wb-filter-count').text('0');
                    }
                } else {
                    console.error('Count request failed:', xhr.status, xhr.statusText);
                    $('#wb-filter-count').text('0');
                }
            };
            
            xhr.onerror = function() {
                console.error('Count request network error');
                $('#wb-filter-count').text('0');
            };
            
            xhr.send();
        } else if (isShopPage && shopFilterForm) {
            // Для страницы shop используем fallback - делаем запрос к filter_products
            console.log('Using shop page fallback for count');
            
            // Формируем параметры из filterState
            const params = new URLSearchParams();
            if (filterState.categories.length > 0) {
                filterState.categories.forEach(cat => params.append('categories[]', cat));
            }
            if (filterState.brands.length > 0) {
                filterState.brands.forEach(brand => params.append('brand', brand));
            }
            if (filterState.sizes.length > 0) {
                filterState.sizes.forEach(size => params.append('size', size));
            }
            if (filterState.colors.length > 0) {
                filterState.colors.forEach(color => params.append('color', color));
            }
            if (filterState.priceRange.min > 0) {
                params.set('price_min', filterState.priceRange.min);
            }
            const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
            if (filterState.priceRange.max < defaultMaxPrice) {
                params.set('price_max', filterState.priceRange.max);
            }
            
            // Делаем запрос для получения количества
            $.ajax({
                url: '/filter_products/',
                method: 'GET',
                data: params.toString(),
                success: function(response) {
                    if (response.product_count !== undefined) {
                        $('#wb-filter-count').text(response.product_count);
                    } else {
                        $('#wb-filter-count').text('0');
                    }
                },
                error: function() {
                    $('#wb-filter-count').text('0');
                }
            });
        } else {
            console.log('Fallback: using DOM count', {
                hasCategoryForm: !!categoryFilterForm,
                hasShopForm: !!shopFilterForm,
                hasGetFormParams: typeof window.getFormParams === 'function',
                categoryId: categoryId,
                isShopPage: isShopPage
            });
            
            // Fallback: используем значение из DOM
            const productCountElement = $('#product-count, .product_count');
            if (productCountElement.length > 0) {
                const count = parseInt(productCountElement.text()) || 0;
                $('#wb-filter-count').text(count);
            } else {
                $('#wb-filter-count').text('0');
            }
        }
    }

    // ========== ЗАГРУЗКА МЕТАДАННЫХ ФИЛЬТРОВ ==========
    function loadFilterMetadata() {
        // Устанавливаем значения по умолчанию, если метаданные еще не загружены
        if (!filterMetadata.priceRange) {
            filterMetadata.priceRange = { min: 0, max: 10000 };
        }
        
        $.ajax({
            url: "/api/filter_metadata/",
            method: "GET",
            success: function(data) {
                filterMetadata = data;
                // Убеждаемся, что priceRange всегда определен
                if (!filterMetadata.priceRange) {
                    filterMetadata.priceRange = { min: 0, max: 10000 };
                }
                console.log('Filter metadata loaded:', filterMetadata);
            },
            error: function() {
                console.error("Ошибка при загрузке метаданных фильтров");
                // Устанавливаем значения по умолчанию при ошибке
                if (!filterMetadata.priceRange) {
                    filterMetadata.priceRange = { min: 0, max: 10000 };
                }
            }
        });
    }

    // ========== СОХРАНЕНИЕ/ВОССТАНОВЛЕНИЕ ФИЛЬТРОВ ==========
    function saveFiltersToStorage() {
        try {
            localStorage.setItem('wb_filters', JSON.stringify(filterState));
        } catch (e) {
            console.error("Ошибка при сохранении фильтров:", e);
        }
    }

    function restoreFiltersFromStorage() {
        try {
            const saved = localStorage.getItem('wb_filters');
            if (saved) {
                filterState = JSON.parse(saved);
            }
        } catch (e) {
            console.error("Ошибка при восстановлении фильтров:", e);
        }
    }

    function restoreFiltersFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        filterState.categories = urlParams.getAll('categories[]').map(Number);
        filterState.brands = urlParams.getAll('brands[]');
        filterState.rating = urlParams.getAll('rating[]').map(Number);
        filterState.sizes = urlParams.getAll('sizes[]');
        filterState.colors = urlParams.getAll('colors[]');
        filterState.sortBy = urlParams.get('prices') || '';
        
        const minPrice = urlParams.get('min_price');
        const maxPrice = urlParams.get('max_price');
        if (minPrice) filterState.priceRange.min = parseFloat(minPrice);
        if (maxPrice) filterState.priceRange.max = parseFloat(maxPrice);
    }

    function updateURL() {
        const url = new URL(window.location);
        
        // Очищаем параметры
        ['categories[]', 'brands[]', 'rating[]', 'sizes[]', 'colors[]', 'prices', 'min_price', 'max_price'].forEach(function(param) {
            url.searchParams.delete(param);
        });
        
        // Добавляем новые
        filterState.categories.forEach(function(cat) {
            url.searchParams.append('categories[]', cat);
        });
        filterState.brands.forEach(function(brand) {
            url.searchParams.append('brands[]', brand);
        });
        filterState.rating.forEach(function(rating) {
            url.searchParams.append('rating[]', rating);
        });
        filterState.sizes.forEach(function(size) {
            url.searchParams.append('sizes[]', size);
        });
        filterState.colors.forEach(function(color) {
            url.searchParams.append('colors[]', color);
        });
        if (filterState.sortBy) {
            url.searchParams.set('prices', filterState.sortBy);
        }
        if (filterState.priceRange.min > 0) {
            url.searchParams.set('min_price', filterState.priceRange.min);
        }
        const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
        if (filterState.priceRange.max < defaultMaxPrice) {
            url.searchParams.set('max_price', filterState.priceRange.max);
        }
        
        window.history.pushState({}, '', url);
    }

    function updateActiveFilters() {
        // Обновляем визуальное отображение активных фильтров
        $('.wb-filter-chip-btn').each(function() {
            const filterType = $(this).data('filter');
            let isActive = false;
            
            switch(filterType) {
                case 'categories':
                    isActive = filterState.categories.length > 0;
                    break;
                case 'brand':
                    isActive = filterState.brands.length > 0;
                    break;
                case 'rating':
                    isActive = filterState.rating.length > 0;
                    break;
                case 'size':
                    isActive = filterState.sizes.length > 0;
                    break;
                case 'color':
                    isActive = filterState.colors.length > 0;
                    break;
                case 'price':
                    const defaultMaxPrice = (filterMetadata.priceRange && filterMetadata.priceRange.max) ? filterMetadata.priceRange.max : 10000;
                    isActive = filterState.priceRange.min > 0 || filterState.priceRange.max < defaultMaxPrice;
                    break;
                case 'sort':
                    isActive = filterState.sortBy !== '';
                    break;
            }
            
            $(this).toggleClass('active', isActive);
        });
    }

    function updateMobileView() {
        const mobileBreakpoint = 991;
        isMobile = window.innerWidth <= mobileBreakpoint;
        
        if (isMobile) {
            $('#wb-mobile-filter-bar').show().css('display', 'block');
            $('.wb-filters-sidebar').closest('.col-lg-3').hide();
            console.log('Mobile view: Filter bar shown');
        } else {
            $('#wb-mobile-filter-bar').hide();
            $('.wb-filters-sidebar').closest('.col-lg-3').show();
            console.log('Desktop view: Filter bar hidden');
        }
    }

    // ========== УТИЛИТЫ ==========
    // Оптимизированный debounce с поддержкой immediate
    function debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    // Кэш для AJAX запросов (оптимизация для мобильных)
    const ajaxCache = new Map();
    const CACHE_TTL = 30000; // 30 секунд
    
    function getCachedResponse(url) {
        const cached = ajaxCache.get(url);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
        ajaxCache.delete(url);
        return null;
    }
    
    function setCachedResponse(url, data) {
        ajaxCache.set(url, {
            data: data,
            timestamp: Date.now()
        });
        // Очищаем старые записи (оставляем только последние 10)
        if (ajaxCache.size > 10) {
            const firstKey = ajaxCache.keys().next().value;
            ajaxCache.delete(firstKey);
        }
    }

    // Экспорт функций для использования в других скриптах
    window.wbFilters = {
        applyFilters: applyFilters,
        resetFilters: resetFilters,
        updateFilterState: updateFilterState
    };

})(jQuery);

