/**
 * ============================================
 * WILDBERRIES-STYLE SHOP PAGE JAVASCRIPT
 * Улучшенная фильтрация и infinite scroll
 * ============================================
 */

(function($) {
    'use strict';

    // ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ==========
    let currentPage = 1;
    let isLoading = false;
    let hasMorePages = true;
    let currentFilters = {
        categories: [],
        rating: [],
        colors: [],
        sizes: [],
        prices: "",
        display: "",
        searchFilter: ""
    };

    // ========== ИНИЦИАЛИЗАЦИЯ ==========
    $(document).ready(function() {
        // Проверяем, что мы на странице shop
        // Ищем либо по ID, либо по классу (для совместимости)
        const productsContainer = $('#products-list').length > 0 ? $('#products-list') : $('.wb-products-grid');
        
        if (productsContainer.length > 0) {
            window.wbShopInitialized = true; // Флаг для function.js
            
            // Если контейнер найден по классу, но не имеет ID - добавляем его
            if (!productsContainer.attr('id')) {
                productsContainer.attr('id', 'products-list');
            }
            
            initializeFilters();
            initializeInfiniteScroll();
            initializeFilterChips();
            
            // Логируем для отладки
            console.log('Shop.js initialized. Products container found:', productsContainer.length);
        } else {
            console.log('Shop.js: Products container not found. Page might not be shop page.');
        }
    });

    // ========== ИНИЦИАЛИЗАЦИЯ ФИЛЬТРОВ ==========
    function initializeFilters() {
        // Восстанавливаем выбранные фильтры из URL или localStorage
        restoreFiltersFromURL();
        
        // Обработчик изменения фильтров
        $(document).on("change", ".category-filter, .rating-filter, .size-filter, .colors-filter, input[name='price-filter'], input[name='items-display'], .search-filter", function() {
            updateFilters();
            applyFilters();
        });

        // Обработчик сброса фильтров
        $(document).on("click", ".reset_shop_filter_btn", function() {
            resetFilters();
        });

        // Обработчик поиска (с задержкой для debounce)
        let searchTimeout;
        $(document).on("input", ".search-filter", function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() {
                updateFilters();
                applyFilters();
            }, 500); // Задержка 500ms для оптимизации
        });
    }

    // ========== ОБНОВЛЕНИЕ ОБЪЕКТА ФИЛЬТРОВ ==========
    function updateFilters() {
        currentFilters = {
            categories: [],
            rating: [],
            colors: [],
            sizes: [],
            prices: "",
            display: "",
            searchFilter: ""
        };

        // Собираем выбранные категории
        $(".category-filter:checked").each(function() {
            currentFilters.categories.push($(this).val());
        });

        // Собираем выбранные рейтинги
        $(".rating-filter:checked").each(function() {
            currentFilters.rating.push($(this).val());
        });

        // Собираем выбранные размеры
        $(".size-filter:checked").each(function() {
            currentFilters.sizes.push($(this).val());
        });

        // Собираем выбранные цвета
        $(".colors-filter:checked").each(function() {
            currentFilters.colors.push($(this).val());
        });

        // Получаем сортировку по цене
        currentFilters.prices = $("input[name='price-filter']:checked").val() || "";

        // Получаем количество товаров для отображения
        currentFilters.display = $("input[name='items-display']:checked").val() || "";

        // Получаем поисковый запрос
        currentFilters.searchFilter = $(".search-filter").val() || "";

        // Сохраняем фильтры в URL (для возможности поделиться ссылкой)
        updateURL();
    }

    // ========== ПРИМЕНЕНИЕ ФИЛЬТРОВ (AJAX) ==========
    function applyFilters(page = 1) {
        if (isLoading) return;

        isLoading = true;
        currentPage = page;
        hasMorePages = true;

        // Показываем индикатор загрузки
        showLoading();

        // Подготавливаем данные для AJAX запроса
        // Важно: используем правильный формат для массивов
        const ajaxData = {};
        
        // Добавляем массивы с правильным форматом
        if (currentFilters.categories.length > 0) {
            ajaxData['categories[]'] = currentFilters.categories;
        }
        if (currentFilters.rating.length > 0) {
            ajaxData['rating[]'] = currentFilters.rating;
        }
        if (currentFilters.sizes.length > 0) {
            ajaxData['sizes[]'] = currentFilters.sizes;
        }
        if (currentFilters.colors.length > 0) {
            ajaxData['colors[]'] = currentFilters.colors;
        }
        
        // Добавляем одиночные значения
        if (currentFilters.prices) {
            ajaxData['prices'] = currentFilters.prices;
        }
        if (currentFilters.display) {
            ajaxData['display'] = currentFilters.display;
        }
        if (currentFilters.searchFilter) {
            ajaxData['searchFilter'] = currentFilters.searchFilter;
        }
        
        ajaxData['page'] = page;
        ajaxData['per_page'] = 20;

        // Отправляем AJAX запрос
        console.log("Sending AJAX request with filters:", ajaxData);
        
        $.ajax({
            url: "/filter_products/",
            method: "GET",
            data: ajaxData,
            traditional: true, // Важно для правильной передачи массивов в jQuery
            success: function(response) {
                // Находим контейнер для товаров (строго по ID)
                const productsContainer = $("#products-list");
                
                if (productsContainer.length === 0) {
                    console.error("Products container #products-list not found!");
                    hideLoading();
                    isLoading = false;
                    return;
                }
                
                if (page === 1) {
                    // Первая страница - полностью заменяем содержимое контейнера
                    // Важно: заменяем innerHTML, чтобы не трогать сам контейнер grid
                    productsContainer.empty(); // Очищаем полностью
                    productsContainer.append(response.html); // Добавляем новые карточки
                    
                    // Принудительно пересчитываем layout после вставки
                    productsContainer[0].offsetHeight; // Trigger reflow
                } else {
                    // Последующие страницы - добавляем к существующему
                    productsContainer.append(response.html);
                }
                
                // Убеждаемся, что сетка перестроилась корректно
                // Удаляем любые пустые элементы, дубли или лишние обертки
                productsContainer.find('.wb-product-card:empty').remove();
                productsContainer.find('.wb-products-grid').not('#products-list').each(function() {
                    // Если есть вложенная сетка (неправильная структура), распаковываем её
                    $(this).children().unwrap();
                });
                
                // Убеждаемся, что все карточки имеют правильную структуру
                productsContainer.find('.wb-product-card').each(function() {
                    const $card = $(this);
                    // Проверяем, что карточка не пустая и имеет правильную структуру
                    if ($card.find('.wb-product-image-wrapper').length === 0) {
                        $card.remove();
                    }
                });
                
                // Принудительно обновляем layout после вставки
                // Используем requestAnimationFrame для плавного обновления
                requestAnimationFrame(function() {
                    if (typeof productsContainer[0] !== 'undefined') {
                        // Принудительный reflow для пересчета сетки
                        void productsContainer[0].offsetHeight;
                    }
                });

                // Обновляем счетчик товаров
                $(".product_count").text(response.product_count);

                // Обновляем информацию о пагинации
                hasMorePages = response.has_next;
                currentPage = response.page;

                // Обновляем чипсы фильтров
                updateFilterChips();

                // Скрываем индикатор загрузки
                hideLoading();

                // Показываем/скрываем пагинацию (fallback)
                updatePagination(response);

                isLoading = false;
            },
            error: function(xhr, status, error) {
                console.error("Ошибка при загрузке товаров:", error);
                showError("Произошла ошибка при загрузке товаров. Пожалуйста, попробуйте еще раз.");
                hideLoading();
                isLoading = false;
            }
        });
    }

    // ========== INFINITE SCROLL ==========
    function initializeInfiniteScroll() {
        let scrollTimeout;
        
        $(window).on('scroll', function() {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(function() {
                // Проверяем, достигли ли мы конца страницы
                if ($(window).scrollTop() + $(window).height() >= $(document).height() - 300) {
                    // Загружаем следующую страницу, если есть
                    if (hasMorePages && !isLoading) {
                        applyFilters(currentPage + 1);
                    }
                }
            }, 100);
        });
    }

    // ========== ЧИПСЫ ФИЛЬТРОВ ==========
    function initializeFilterChips() {
        // Создаем контейнер для чипсов, если его нет
        if ($("#wb-filter-chips").length === 0) {
            $(".wb-filters-section").after('<div id="wb-filter-chips" class="wb-filter-chips"></div>');
        }
        updateFilterChips();
    }

    function updateFilterChips() {
        const chipsContainer = $("#wb-filter-chips");
        chipsContainer.empty();

        let hasFilters = false;

        // Чипс для категорий
        $(".category-filter:checked").each(function() {
            const categoryId = $(this).val();
            const categoryName = $(this).closest('.form-check').find('label').text().trim();
            chipsContainer.append(createFilterChip('category', categoryId, categoryName));
            hasFilters = true;
        });

        // Чипс для рейтингов
        $(".rating-filter:checked").each(function() {
            const ratingId = $(this).val();
            const ratingValue = $(this).closest('.form-check').find('label').text().trim();
            chipsContainer.append(createFilterChip('rating', ratingId, ratingValue));
            hasFilters = true;
        });

        // Чипс для размеров
        $(".size-filter:checked").each(function() {
            const sizeValue = $(this).val();
            const sizeName = $(this).closest('.form-check').find('label').text().trim();
            chipsContainer.append(createFilterChip('size', sizeValue, sizeName));
            hasFilters = true;
        });

        // Чипс для цветов
        $(".colors-filter:checked").each(function() {
            const colorValue = $(this).val();
            const colorName = $(this).closest('.form-check').find('label').text().trim() || 'Цвет';
            chipsContainer.append(createFilterChip('color', colorValue, colorName));
            hasFilters = true;
        });

        // Чипс для сортировки по цене
        const priceFilter = $("input[name='price-filter']:checked");
        if (priceFilter.length > 0) {
            const priceValue = priceFilter.val();
            const priceName = priceFilter.closest('.form-check').find('label').text().trim();
            chipsContainer.append(createFilterChip('price', priceValue, priceName));
            hasFilters = true;
        }

        // Чипс для поиска
        const searchValue = $(".search-filter").val();
        if (searchValue && searchValue.trim() !== "") {
            chipsContainer.append(createFilterChip('search', searchValue, 'Поиск: ' + searchValue));
            hasFilters = true;
        }

        // Если фильтров нет, показываем сообщение
        if (!hasFilters) {
            chipsContainer.html('<span class="wb-filter-chips-empty">Фильтры не выбраны</span>');
        }
    }

    function createFilterChip(type, value, label) {
        const chip = $('<div class="wb-filter-chip" data-filter-type="' + type + '" data-filter-value="' + value + '">' +
            '<span class="chip-label">' + label + '</span>' +
            '<span class="chip-remove"><i class="fas fa-times"></i></span>' +
            '</div>');
        
        // Обработчик удаления чипса
        chip.find('.chip-remove').on('click', function(e) {
            e.stopPropagation();
            removeFilter(type, value);
        });
        
        return chip;
    }

    function removeFilter(type, value) {
        switch(type) {
            case 'category':
                $('#category' + value).prop('checked', false);
                break;
            case 'rating':
                $('#rating' + value).prop('checked', false);
                break;
            case 'size':
                $('.size-filter[value="' + value + '"]').prop('checked', false);
                break;
            case 'color':
                $('.colors-filter[value="' + value + '"]').prop('checked', false);
                break;
            case 'price':
                $("input[name='price-filter']:checked").prop('checked', false);
                break;
            case 'search':
                $(".search-filter").val('');
                break;
        }
        updateFilters();
        applyFilters();
    }

    // ========== СБРОС ФИЛЬТРОВ ==========
    function resetFilters() {
        // Снимаем все чекбоксы и радиокнопки
        $(".category-filter, .rating-filter, .size-filter, .colors-filter").prop('checked', false);
        $("input[name='price-filter'], input[name='items-display']").prop('checked', false);
        $(".search-filter").val('');
        
        // Сбрасываем объект фильтров
        currentFilters = {
            categories: [],
            rating: [],
            colors: [],
            sizes: [],
            prices: "",
            display: "",
            searchFilter: ""
        };
        
        // Применяем фильтры (загружаем все товары)
        applyFilters();
    }

    // ========== ВОССТАНОВЛЕНИЕ ФИЛЬТРОВ ИЗ URL ==========
    function restoreFiltersFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        
        // Восстанавливаем категории
        const categories = urlParams.getAll('categories[]');
        categories.forEach(function(catId) {
            $('#category' + catId).prop('checked', true);
        });
        
        // Восстанавливаем рейтинги
        const ratings = urlParams.getAll('rating[]');
        ratings.forEach(function(ratingId) {
            $('#rating' + ratingId).prop('checked', true);
        });
        
        // Восстанавливаем размеры
        const sizes = urlParams.getAll('sizes[]');
        sizes.forEach(function(size) {
            $('.size-filter[value="' + size + '"]').prop('checked', true);
        });
        
        // Восстанавливаем цвета
        const colors = urlParams.getAll('colors[]');
        colors.forEach(function(color) {
            $('.colors-filter[value="' + color + '"]').prop('checked', true);
        });
        
        // Восстанавливаем сортировку по цене
        const price = urlParams.get('prices');
        if (price) {
            $('input[name="price-filter"][value="' + price + '"]').prop('checked', true);
        }
        
        // Восстанавливаем поиск
        const search = urlParams.get('searchFilter');
        if (search) {
            $(".search-filter").val(search);
        }
        
        // Обновляем фильтры и применяем их
        updateFilters();
        if (Object.keys(currentFilters).some(key => {
            if (Array.isArray(currentFilters[key])) {
                return currentFilters[key].length > 0;
            }
            return currentFilters[key] !== "";
        })) {
            applyFilters();
        }
    }

    // ========== ОБНОВЛЕНИЕ URL ==========
    function updateURL() {
        const url = new URL(window.location);
        
        // Очищаем старые параметры фильтров
        url.searchParams.delete('categories[]');
        url.searchParams.delete('rating[]');
        url.searchParams.delete('sizes[]');
        url.searchParams.delete('colors[]');
        url.searchParams.delete('prices');
        url.searchParams.delete('searchFilter');
        
        // Добавляем новые параметры
        currentFilters.categories.forEach(function(cat) {
            url.searchParams.append('categories[]', cat);
        });
        currentFilters.rating.forEach(function(rating) {
            url.searchParams.append('rating[]', rating);
        });
        currentFilters.sizes.forEach(function(size) {
            url.searchParams.append('sizes[]', size);
        });
        currentFilters.colors.forEach(function(color) {
            url.searchParams.append('colors[]', color);
        });
        if (currentFilters.prices) {
            url.searchParams.set('prices', currentFilters.prices);
        }
        if (currentFilters.searchFilter) {
            url.searchParams.set('searchFilter', currentFilters.searchFilter);
        }
        
        // Обновляем URL без перезагрузки страницы
        window.history.pushState({}, '', url);
    }

    // ========== ИНДИКАТОРЫ ЗАГРУЗКИ ==========
    function showLoading() {
        if ($("#wb-loading").length === 0) {
            const productsContainer = $("#products-list").length > 0 ? $("#products-list") : $(".wb-products-grid");
            if (productsContainer.length > 0) {
                productsContainer.after('<div id="wb-loading" class="wb-loading"><div class="wb-loading-spinner"></div></div>');
            }
        }
    }

    function hideLoading() {
        $("#wb-loading").remove();
    }

    function showError(message) {
        if ($("#wb-error").length === 0) {
            const productsContainer = $("#products-list").length > 0 ? $("#products-list") : $(".wb-products-grid");
            if (productsContainer.length > 0) {
                productsContainer.after('<div id="wb-error" class="wb-empty-state"><div class="wb-empty-state-icon">⚠️</div><div class="wb-empty-state-text">' + message + '</div></div>');
            }
        }
    }

    // ========== ПАГИНАЦИЯ (FALLBACK) ==========
    function updatePagination(response) {
        const paginationContainer = $("#wb-pagination");
        const productsContainer = $("#products-list").length > 0 ? $("#products-list") : $(".wb-products-grid");
        
        if (!response.has_next && currentPage === 1) {
            // Нет следующей страницы и это первая страница - скрываем пагинацию
            paginationContainer.remove();
            return;
        }
        
        // Создаем контейнер пагинации, если его нет
        if (paginationContainer.length === 0 && productsContainer.length > 0) {
            productsContainer.after('<div id="wb-pagination" class="wb-pagination"></div>');
        }
        
        let paginationHTML = '';
        
        // Кнопка "Назад"
        if (response.has_previous) {
            paginationHTML += '<button class="wb-pagination-btn" data-page="' + (currentPage - 1) + '">← Назад</button>';
        }
        
        // Номера страниц
        const totalPages = response.num_pages;
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += '<button class="wb-pagination-btn" data-page="1">1</button>';
            if (startPage > 2) {
                paginationHTML += '<span>...</span>';
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? 'active' : '';
            paginationHTML += '<button class="wb-pagination-btn ' + activeClass + '" data-page="' + i + '">' + i + '</button>';
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += '<span>...</span>';
            }
            paginationHTML += '<button class="wb-pagination-btn" data-page="' + totalPages + '">' + totalPages + '</button>';
        }
        
        // Кнопка "Вперед"
        if (response.has_next) {
            paginationHTML += '<button class="wb-pagination-btn" data-page="' + (currentPage + 1) + '">Вперед →</button>';
        }
        
        paginationContainer.html(paginationHTML);
        
        // Обработчик клика на кнопки пагинации
        paginationContainer.find('.wb-pagination-btn').on('click', function() {
            const page = $(this).data('page');
            if (page && page !== currentPage) {
                $('html, body').animate({ scrollTop: 0 }, 300);
                applyFilters(page);
            }
        });
    }

})(jQuery);

