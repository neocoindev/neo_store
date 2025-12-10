/**
 * ============================================
 * WILDBERRIES-STYLE MOBILE FILTERS SYSTEM
 * Мобильная система фильтрации в стиле Wildberries
 * ============================================
 */

(function($) {
    'use strict';

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
    $(document).ready(function() {
        // Небольшая задержка для гарантии, что DOM полностью загружен
        setTimeout(function() {
            if ($('#products-list').length > 0 || $('.wb-products-grid').length > 0) {
                console.log('Initializing filters...');
                initializeFilters();
                loadFilterMetadata();
                restoreFiltersFromStorage();
                updateMobileView();
                
                // Обработка изменения размера окна
                $(window).on('resize', debounce(function() {
                    isMobile = window.innerWidth <= 991;
                    updateMobileView();
                }, 250));
                
                console.log('Filters initialized. Mobile:', isMobile);
            } else {
                console.log('Products container not found, filters not initialized');
            }
        }, 100);
    });

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
            
            if (searchSection.length > 0) {
                searchSection.after(filterBar);
            } else if (productsContainer.length > 0) {
                productsContainer.before(filterBar);
            } else if (container.length > 0) {
                container.find('.row').first().before(filterBar);
            } else {
                $('section.middle').prepend(filterBar);
            }
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
        // Открытие модального окна при клике на кнопку фильтра
        $(document).on('click', '.wb-filter-chip-btn', function() {
            const filterType = $(this).data('filter');
            openFilterModal(filterType);
        });

        // Закрытие модального окна
        $(document).on('click', '.wb-filter-modal-close, .wb-filter-modal-backdrop', function() {
            closeFilterModal();
        });

        // Применение фильтров
        $(document).on('click', '.wb-filter-apply-btn', function() {
            applyFilters();
            closeFilterModal();
        });

        // Сброс фильтров
        $(document).on('click', '.wb-filter-reset-btn', function() {
            resetFilters();
        });

        // Обработка изменений в фильтрах
        $(document).on('change', '.wb-filter-checkbox, .wb-filter-radio, .wb-filter-range', function() {
            updateFilterState();
            updateFilterCount();
        });

        // Обработка слайдера цены
        $(document).on('input', '#wb-price-range-min, #wb-price-range-max', function() {
            updatePriceRange();
        });
    }

    // ========== ОТКРЫТИЕ МОДАЛЬНОГО ОКНА ==========
    function openFilterModal(filterType) {
        isFilterModalOpen = true;
        const modal = $('#wb-filter-modal');
        const content = $('#wb-filter-content');
        
        // Генерируем контент в зависимости от типа фильтра
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
        }
        
        content.html(html);
        modal.addClass('active');
        $('body').addClass('modal-open');
        
        // Обновляем счетчик товаров
        updateFilterCount();
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
        const priceMin = filterMetadata.priceRange.min || 0;
        const priceMax = filterMetadata.priceRange.max || 10000;
        const minPrice = filterState.priceRange.min || priceMin;
        const maxPrice = filterState.priceRange.max || priceMax;
        
        let html = '<div class="wb-filter-section">';
        html += '<h4>Цена</h4>';
        html += '<div class="wb-price-filter">';
        html += `<div class="wb-price-inputs">
            <input type="number" id="wb-price-range-min" class="wb-filter-range" 
                   placeholder="От" value="${minPrice}" min="${priceMin}" max="${priceMax}">
            <span>-</span>
            <input type="number" id="wb-price-range-max" class="wb-filter-range" 
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
        filterState.sortBy = '';
        
        $('.wb-filter-checkbox[data-filter="categories"]:checked').each(function() {
            filterState.categories.push($(this).data('value'));
        });
        
        $('.wb-filter-checkbox[data-filter="brands"]:checked').each(function() {
            filterState.brands.push($(this).data('value'));
        });
        
        $('.wb-filter-radio[data-filter="rating"]:checked').each(function() {
            filterState.rating.push($(this).data('value'));
        });
        
        $('.wb-filter-checkbox[data-filter="sizes"]:checked').each(function() {
            filterState.sizes.push($(this).data('value'));
        });
        
        $('.wb-filter-checkbox[data-filter="colors"]:checked').each(function() {
            filterState.colors.push($(this).data('value'));
        });
        
        const sortRadio = $('.wb-filter-radio[data-filter="sort"]:checked');
        if (sortRadio.length > 0) {
            filterState.sortBy = sortRadio.data('value');
        }
        
        // Сохраняем в localStorage
        saveFiltersToStorage();
    }

    function updatePriceRange() {
        const minPrice = parseFloat($('#wb-price-range-min').val()) || 0;
        const maxPrice = parseFloat($('#wb-price-range-max').val()) || filterMetadata.priceRange.max;
        
        filterState.priceRange = { min: minPrice, max: maxPrice };
        saveFiltersToStorage();
    }

    // ========== ПРИМЕНЕНИЕ ФИЛЬТРОВ ==========
    function applyFilters() {
        updateFilterState();
        
        // Используем существующую функцию из shop.js, если она доступна
        if (typeof window.wbShopInitialized !== 'undefined' && window.wbShopInitialized) {
            // Обновляем фильтры в shop.js
            updateShopFilters();
            // Вызываем applyFilters из shop.js
            if (typeof applyFilters === 'function') {
                applyFilters(1);
            } else {
                // Fallback: делаем AJAX запрос напрямую
                makeFilterRequest();
            }
        } else {
            makeFilterRequest();
        }
        
        updateURL();
        updateActiveFilters();
    }

    function makeFilterRequest() {
        const ajaxData = {};
        
        if (filterState.categories.length > 0) {
            ajaxData['categories[]'] = filterState.categories;
        }
        if (filterState.brands.length > 0) {
            ajaxData['brands[]'] = filterState.brands;
        }
        if (filterState.rating.length > 0) {
            ajaxData['rating[]'] = filterState.rating;
        }
        if (filterState.sizes.length > 0) {
            ajaxData['sizes[]'] = filterState.sizes;
        }
        if (filterState.colors.length > 0) {
            ajaxData['colors[]'] = filterState.colors;
        }
        if (filterState.priceRange.min > 0) {
            ajaxData['min_price'] = filterState.priceRange.min;
        }
        if (filterState.priceRange.max < filterMetadata.priceRange.max) {
            ajaxData['max_price'] = filterState.priceRange.max;
        }
        if (filterState.sortBy) {
            ajaxData['prices'] = filterState.sortBy;
        }
        if (filterState.searchQuery) {
            ajaxData['searchFilter'] = filterState.searchQuery;
        }
        
        ajaxData['page'] = 1;
        ajaxData['per_page'] = 20;
        
        console.log('Sending filter request:', ajaxData);
        
        // Показываем индикатор загрузки
        const productsContainer = $("#products-list");
        if (productsContainer.length > 0) {
            productsContainer.prepend('<div class="wb-filter-loading"><div class="wb-filter-loading-spinner"></div></div>');
        }
        
        $.ajax({
            url: "/filter_products/",
            method: "GET",
            data: ajaxData,
            traditional: true,
            success: function(response) {
                console.log('Filter response received:', response);
                if (productsContainer.length > 0) {
                    productsContainer.find('.wb-filter-loading').remove();
                    productsContainer.html(response.html);
                    $(".product_count").text(response.product_count);
                }
            },
            error: function(xhr, status, error) {
                console.error("Ошибка при применении фильтров:", error, xhr);
                productsContainer.find('.wb-filter-loading').remove();
                alert('Произошла ошибка при применении фильтров. Пожалуйста, попробуйте еще раз.');
            }
        });
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
        $('#wb-price-range-min').val(filterMetadata.priceRange.min || 0);
        $('#wb-price-range-max').val(filterMetadata.priceRange.max || 10000);
        
        saveFiltersToStorage();
        applyFilters();
    }

    // ========== ОБНОВЛЕНИЕ СЧЕТЧИКА ТОВАРОВ ==========
    function updateFilterCount() {
        // Здесь можно сделать AJAX запрос для получения актуального количества
        // Пока используем заглушку
        const count = 0; // TODO: получить реальное количество
        $('#wb-filter-count').text(count);
    }

    // ========== ЗАГРУЗКА МЕТАДАННЫХ ФИЛЬТРОВ ==========
    function loadFilterMetadata() {
        $.ajax({
            url: "/api/filter_metadata/",
            method: "GET",
            success: function(data) {
                filterMetadata = data;
            },
            error: function() {
                console.error("Ошибка при загрузке метаданных фильтров");
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
        if (filterState.priceRange.max < filterMetadata.priceRange.max) {
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
                    isActive = filterState.priceRange.min > 0 || filterState.priceRange.max < filterMetadata.priceRange.max;
                    break;
                case 'sort':
                    isActive = filterState.sortBy !== '';
                    break;
            }
            
            $(this).toggleClass('active', isActive);
        });
    }

    function updateMobileView() {
        if (isMobile) {
            $('#wb-mobile-filter-bar').show();
            $('.wb-filters-sidebar').closest('.col-lg-3').hide();
        } else {
            $('#wb-mobile-filter-bar').hide();
            $('.wb-filters-sidebar').closest('.col-lg-3').show();
        }
    }

    // ========== УТИЛИТЫ ==========
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Экспорт функций для использования в других скриптах
    window.wbFilters = {
        applyFilters: applyFilters,
        resetFilters: resetFilters,
        updateFilterState: updateFilterState
    };

})(jQuery);

