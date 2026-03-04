jQuery(document).ready(function ($) {
    // State Management
    var setData = null;
    var agreementList = [];
    var userInputs = {};

    // Initialization
    function resetSetState() {
        userInputs = {
            condition: 'used',
            seals_intact: true,
            box_condition: 'like_new',
            is_complete: true,
            completion_level: '100',
            is_built: true,
            weight: 0,
            has_box: true,
            has_instructions: true,
            missing_minifigs: {}
        };
    }
    resetSetState();

    // 1. Search Logic
    $('#tee-search-set').on('click', function () {
        searchSet();
    });

    $('#tee-set-number').on('keypress', function (e) {
        if (e.which == 13) searchSet();
    });

    function searchSet() {
        var input = $('#tee-set-number').val().trim();
        if (!input) return;

        $('#tee-search-error, #tee-exclusion-alert, #tee-search-results').hide();
        $('#tee-loading').show();
        $('#tee-search-set').prop('disabled', true);
        $('#tee-result-ui, #tee-main-ui, #tee-set-preview, #tee-minifigs-ui').hide();

        resetSetState();
        $('#tee-minifigs-list').empty().removeData('rendered-set');
        $('.tee-cond-card').removeClass('active');
        $('.tee-cond-card[data-cond="used"]').addClass('active');

        // Check if it's a set number (numeric or numeric-suffix)
        var isSetNumber = /^\d+(-\d+)?$/.test(input);

        if (isSetNumber) {
            // Direct Bricklink Lookup
            $.ajax({
                url: tee_vars.ajax_url,
                type: 'POST',
                data: {
                    action: 'tee_evaluate_set',
                    nonce: tee_vars.nonce,
                    set_number: input
                },
                success: function (response) {
                    $('#tee-loading').hide();
                    $('#tee-search-set').prop('disabled', false);

                    if (response.success) {
                        setData = response.data;
                        userInputs.weight = parseFloat(setData.weight) || 0;

                        if (parseInt(setData.category_id) === 9) {
                            var alertHtml = '<h3>Unfortunate News</h3>' +
                                '<p>We would love to buy your LEGO, however we do not buy Duplo sets as individual items. They simply don\'t hold the same value as regular LEGO.</p>' +
                                '<p><strong>The good news?</strong> We still buy them by weight! Check out our mixed LEGO rates below.</p>' +
                                '<a href="' + (tee_vars.duplo_rejection_url || '/sell-mixed-lego/') + '" class="tee-btn-dark">Sell Duplo by Weight - £4.25/KG</a>';

                            $('#tee-exclusion-alert').html(alertHtml).fadeIn();
                            $('#tee-set-preview').fadeIn();
                            return;
                        }

                        $('#tee-set-image-thumb').attr('src', setData.image);
                        $('#tee-set-name-preview').text(setData.name + ' (#' + setData.id + ')');
                        $('#tee-set-preview').fadeIn();
                        $('#tee-main-ui').fadeIn();

                        renderDynamicFlow();
                    } else {
                        // If Bricklink fails and it was a number, maybe try searching by name anyway?
                        // Or just show error
                        $('#tee-search-error').text(response.data).show();
                    }
                }
            });
        } else {
            // Keyword Search (Rebrickable)
            $.ajax({
                url: tee_vars.ajax_url,
                type: 'POST',
                data: {
                    action: 'tee_search_sets',
                    nonce: tee_vars.nonce,
                    query: input
                },
                success: function (response) {
                    $('#tee-loading').hide();
                    $('#tee-search-set').prop('disabled', false);

                    if (response.success && response.data.length > 0) {
                        var resultsHtml = '';
                        $.each(response.data, function (i, item) {
                            resultsHtml += '<div class="tee-search-result-item" data-id="' + item.id + '">' +
                                '<img src="' + item.image + '" alt="' + item.name + '">' +
                                '<div class="tee-result-info">' +
                                '<strong>' + item.name + '</strong>' +
                                '<span>Set #' + item.id + ' (' + item.year + ')</span>' +
                                '</div>' +
                                '</div>';
                        });
                        $('#tee-search-results').html(resultsHtml).fadeIn();
                    } else {
                        $('#tee-search-error').text(response.data.length === 0 ? 'No sets found matching that name.' : response.data).show();
                    }
                }
            });
        }
    }

    // Handle Search Result Selection
    $(document).on('click', '.tee-search-result-item', function () {
        var setId = $(this).data('id');
        $('#tee-set-number').val(setId);
        $('#tee-search-results').hide();
        searchSet(); // Trigger direct lookup
    });

    // 2. UI Interaction Logic
    $('.tee-cond-card').on('click', function () {
        $('.tee-cond-card').removeClass('active');
        $(this).addClass('active');
        userInputs.condition = $(this).data('cond');
        renderDynamicFlow();
    });

    function renderSwatches(field, options, currentValue) {
        var group = $('<div class="tee-swatch-group" data-field="' + field + '"></div>');
        $.each(options, function (i, opt) {
            var active = (opt.value === currentValue || opt.value === String(currentValue)) ? 'active' : '';
            var swatch = $('<div class="tee-swatch ' + active + '" data-value="' + opt.value + '">' +
                '<span>' + opt.label +
                (opt.desc ? '<span class="tee-info-icon">i<span class="tee-tooltip-text">' + opt.desc + '</span></span>' : '') +
                '</span>' +
                '</div>');
            group.append(swatch);
        });
        return group;
    }

    function renderNewFlow(container) {
        // Q: Seals Intact?
        container.append('<label class="tee-question-label">Are all box seals intact?</label>');
        container.append(renderSwatches('seals_intact', [
            { label: 'Yes', value: true, desc: 'Original tape/seals unbroken' },
            { label: 'No', value: false, desc: 'Seals cut or box opened' }
        ], userInputs.seals_intact));

        if (userInputs.seals_intact) {
            // Seals Yes: Box Condition
            container.append('<label class="tee-question-label">What is the box condition?</label>');
            container.append(renderSwatches('box_condition', [
                { label: 'Like New', value: 'like_new', desc: 'Box is in good condition, with some minor shelf wear accepted. Box should have no major scrapes/dents/holes etc' },
                { label: 'Fair', value: 'fair', desc: 'Box has some signs of larger dents, scratches, label tears/residue. Box should not be heavily crushed, have holes and box and seals must be intact' },
                { label: 'Bad', value: 'bad', desc: 'Box has signs of heavy wear to corners, tears to box artwork, crushing, holes or heavy scratching' }
            ], userInputs.box_condition));
        } else {
            // Seals No: Is Set Complete?
            container.append('<label class="tee-question-label">Is the set complete?</label>');
            container.append(renderSwatches('is_complete', [
                { label: 'Yes', value: true, desc: 'Includes all parts & bags' },
                { label: 'No', value: false, desc: 'Missing parts or bags' }
            ], userInputs.is_complete));

            if (!userInputs.is_complete) {
                // Incomplete: Weight
                var qWeight = $('<div class="tee-question-item">' +
                    '<label class="tee-question-label">Enter weight of all bags present (grams)</label>' +
                    '<input type="number" id="tee-weight-input" class="tee-input" value="' + userInputs.weight + '">' +
                    '</div>');
                container.append(qWeight);
            }
        }

        bindDynamicEvents();
    }

    function renderUsedFlow(container) {
        // Q: How complete?
        container.append('<label class="tee-question-label">How complete is the set?</label>');
        container.append(renderSwatches('completion_level', [
            { label: '100% Complete', value: '100', desc: 'Includes all minifigures' },
            { label: 'Over 95%', value: '95', desc: 'Missing minor parts' },
            { label: 'Under 95%', value: 'less', desc: 'Incomplete/Mixed' }
        ], userInputs.completion_level));

        if (userInputs.completion_level !== 'less') {
            // Built?
            container.append('<label class="tee-question-label">Is the set built up?</label>');
            container.append(renderSwatches('is_built', [
                { label: 'Yes', value: true, desc: 'Currently assembled' },
                { label: 'No', value: false, desc: 'Partially or fully dismantled' }
            ], userInputs.is_built));

            // Box/Instructions (Converted to Swatch)
            container.append('<label class="tee-question-label">Additional Details</label>');
            var detailVal = 'none';
            if (userInputs.has_box && userInputs.has_instructions) detailVal = 'both';
            else if (userInputs.has_box) detailVal = 'box';
            else if (userInputs.has_instructions) detailVal = 'ins';

            container.append(renderSwatches('details_combo', [
                { label: 'Box & Instructions', value: 'both' },
                { label: 'Box Only', value: 'box' },
                { label: 'Instructions Only', value: 'ins' },
                { label: 'Neither', value: 'none' }
            ], detailVal));
        } else {
            // Under 95%: Weight
            var qWeight = $('<div class="tee-question-item">' +
                '<label class="tee-question-label">Enter the weight of the set (grams)</label>' +
                '<input type="number" id="tee-weight-input" class="tee-input" value="' + userInputs.weight + '">' +
                '</div>');
            container.append(qWeight);
        }

        bindDynamicEvents();
    }

    function renderDynamicFlow() {
        var container = $('#tee-dynamic-questions');
        container.empty();

        if (userInputs.condition === 'new') {
            renderNewFlow(container);
        } else {
            renderUsedFlow(container);
        }

        updateMinifigsUI();
        calculateOffer();
    }

    function bindDynamicEvents() {
        // Swatch Clicks
        $('.tee-swatch').off('click').on('click', function () {
            var group = $(this).closest('.tee-swatch-group');
            var field = group.data('field');
            var val = $(this).data('value');

            // Handle boolean strings
            if (val === true || val === 'true') val = true;
            if (val === false || val === 'false') val = false;

            if (field === 'details_combo') {
                userInputs.has_box = (val === 'both' || val === 'box');
                userInputs.has_instructions = (val === 'both' || val === 'ins');
            } else {
                userInputs[field] = val;
            }

            renderDynamicFlow();
        });


        $('#tee-weight-input').on('change keyup', function () {
            userInputs.weight = parseFloat($(this).val()) || 0;
            calculateOffer();
        });
    }

    function updateMinifigsUI() {
        if (userInputs.condition === 'new' && userInputs.seals_intact) {
            $('#tee-minifigs-ui').hide();
        } else {
            if (Object.keys(setData.minifigs_data).length > 0) {
                $('#minifig-instruction-text').text(userInputs.completion_level === 'less' ? 'Which minifigures are present?' : 'Please verify which minifigures are present (unchecked = missing):');
                renderMinifigs();
                $('#tee-minifigs-ui').fadeIn();
            } else {
                $('#tee-minifigs-ui').hide();
            }
        }
    }

    function renderMinifigs() {
        var container = $('#tee-minifigs-list');
        if (container.data('rendered-set') === setData.id) return;

        container.empty();
        container.data('rendered-set', setData.id);

        $.each(setData.minifigs_data, function (id, minifig) {
            var qtyOwned = minifig.qty;
            var debugPrice = '';
            if (tee_vars.debug_mode) {
                debugPrice = '<div class="tee-debug-info">Actual: £' + (parseFloat(minifig.price) || 0).toFixed(2) + '</div>';
            }

            var item = $('<div class="minifig-item" data-id="' + id + '" data-max="' + minifig.qty + '">' +
                '<img src="' + minifig.thumbnail + '" alt="' + minifig.name + '">' +
                '<strong>' + minifig.name + '</strong><br>' +
                debugPrice +
                '<div class="qty-selector">' +
                '<button type="button" class="qty-btn minus">-</button>' +
                '<span class="qty-val">' + qtyOwned + '</span> / ' + minifig.qty +
                '<button type="button" class="qty-btn plus">+</button>' +
                '</div>' +
                '<p class="minifig-status">I have all of these</p>' +
                '</div>');
            container.append(item);
        });

        $('.qty-btn').off('click').on('click', function () {
            var item = $(this).closest('.minifig-item');
            var id = item.data('id');
            var max = parseInt(item.data('max'));
            var valSpan = item.find('.qty-val');
            var current = parseInt(valSpan.text());

            if ($(this).hasClass('plus') && current < max) current++;
            else if ($(this).hasClass('minus') && current > 0) current--;

            valSpan.text(current);
            var status = item.find('.minifig-status');
            if (current === max) {
                status.text('I have all of these').css('color', '');
                delete userInputs.missing_minifigs[id];
            } else {
                var missing = max - current;
                status.text(current === 0 ? 'I am missing all' : 'I am missing ' + missing).css('color', current === 0 ? '#ef4444' : '#f59e0b');
                userInputs.missing_minifigs[id] = missing;
            }
            calculateOffer();
        });
    }

    // 3. Calculation & Results
    function calculateOffer() {
        if (!setData) return;

        $('#tee-final-price').html('<span class="tee-calc-loader"></span>');
        $('#tee-accept-set').prop('disabled', true);

        $.ajax({
            url: tee_vars.ajax_url,
            type: 'POST',
            data: {
                action: 'tee_calculate_offer',
                nonce: tee_vars.nonce,
                set_data: setData,
                user_inputs: userInputs
            },
            success: function (response) {
                $('#tee-accept-set').prop('disabled', false);
                if (response.success) {
                    var data = response.data;
                    if (data.rejected) {
                        $('#tee-final-price').text('£0.00');
                        if (tee_vars.debug_mode) {
                            var actualPrice = (userInputs.condition === 'new') ? setData.prices.new_avg : setData.prices.used_avg;
                            $('#tee-final-price').append('<div class="tee-debug-info">Market: £' + (parseFloat(actualPrice) || 0).toFixed(2) + '</div>');
                        }
                        $('#tee-accept-set').hide();
                        $('#tee-rejection-msg').show();
                        if (data.error_message) {
                            $('#tee-rejection-msg .tee-error').text(data.error_message);
                        }
                        $('#tee-rejection-btn').attr('href', data.rejection_url);
                    } else {
                        var rawOffer = parseFloat(data.offer || 0);
                        var formatter = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        var formattedOffer = formatter.format(rawOffer);

                        $('#tee-final-price').text('£' + formattedOffer);

                        if (tee_vars.debug_mode) {
                            var actualPrice = (userInputs.condition === 'new') ? setData.prices.new_avg : setData.prices.used_avg;
                            $('#tee-final-price').append('<div class="tee-debug-info">Market: £' + (parseFloat(actualPrice) || 0).toFixed(2) + '</div>');
                        }

                        $('#tee-rejection-msg').hide();

                        // High-Value set check (Configurable threshold)
                        var threshold = tee_vars.high_val_threshold || 1000;
                        if (rawOffer > threshold) {
                            $('#tee-high-value-instruction').html(tee_vars.high_val_contact_text);
                            // Hide everything except set preview and the lead form (same as Duplo alert)
                            $('#tee-main-ui, #tee-minifigs-ui, #tee-result-ui').hide();
                            $('#tee-high-value-lead-form').fadeIn();
                            return; // Don't proceed to weight check
                        } else {
                            $('#tee-high-value-lead-form').hide();
                        }

                        // Weight limit check
                        var currentTotalWeight = 0;
                        agreementList.forEach(function (i) {
                            currentTotalWeight += parseFloat(i.weight) || 0;
                        });
                        var incomingWeight = parseFloat(userInputs.weight) || 0;

                        if (currentTotalWeight + incomingWeight > 18000) {
                            $('#tee-accept-set').hide();
                            $('#tee-weight-error-msg').show();
                        } else {
                            $('#tee-accept-set').show();
                            $('#tee-weight-error-msg').hide();
                            updateStickyBar(rawOffer);
                        }
                    }
                    updateResultBanner(data.offer);
                }
            }
        });
    }

    function updateResultBanner(price) {
        $('#tee-res-name').text(setData.name);
        $('#tee-res-id').text('Set #' + setData.id);

        var tagsContainer = $('#tee-res-tags').empty();
        tagsContainer.append('<span class="tee-tag">' + (userInputs.condition === 'new' ? 'New' : 'Used') + '</span>');

        if (userInputs.condition === 'new') {
            tagsContainer.append('<span class="tee-tag">' + (userInputs.seals_intact ? 'Seals Intact' : 'Seals Broken') + '</span>');
        } else {
            tagsContainer.append('<span class="tee-tag">' + userInputs.completion_level + '% Complete</span>');
        }

        $('#tee-result-ui').fadeIn();
    }

    function updateStickyBar(currentOffer) {
        var total = 0;
        var totalWeight = 0;
        agreementList.forEach(function (item) {
            total += parseFloat(item.offer) || 0;
            totalWeight += parseFloat(item.weight) || 0;
        });

        var currentVal = parseFloat(currentOffer) || 0;
        var formatter = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        $('#tee-sticky-current').text('£' + formatter.format(currentVal));
        $('#tee-sticky-total').text('£' + formatter.format(total));
        $('#tee-sticky-bar').fadeIn();

        if (totalWeight >= 18000) { // 18KG in grams
            $('#tee-weight-limit-msg').show();
            $('#tee-accept-set').hide();
            $('#tee-weight-error-msg').show();
        } else {
            $('#tee-weight-limit-msg').hide();
        }
    }

    // 4. Batch Agreement List
    $('#tee-accept-set').on('click', function () {
        var offerText = $('#tee-final-price').text().replace('£', '').replace(/,/g, '');
        var offer = parseFloat(offerText) || 0;

        // Check weight limit before accepting (Double check for safety)
        var currentTotalWeight = 0;
        agreementList.forEach(function (i) {
            currentTotalWeight += parseFloat(i.weight) || 0;
        });

        var incomingWeight = parseFloat(userInputs.weight) || 0;
        if (currentTotalWeight + incomingWeight > 18000) {
            $('#tee-accept-set').hide();
            $('#tee-weight-error-msg').show();
            return;
        }

        agreementList.push({
            id: setData.id,
            name: setData.name,
            offer: offer,
            weight: userInputs.weight,
            image: setData.image,
            metadata: getMetadataString(),
            raw_details: JSON.parse(JSON.stringify(userInputs))
        });

        renderAgreementList();
        $('#tee-main-ui, #tee-result-ui, #tee-minifigs-ui, #tee-set-preview, #tee-high-value-lead-form').hide();
        $('#tee-set-number').val('').focus();
        updateStickyBar(0);
    });

    // Photo preview and validation
    $('#tee-lead-photos').on('change', function () {
        var files = this.files;
        var previewGrid = $('#tee-photo-preview');
        previewGrid.empty();

        if (files.length > 0) {
            $.each(files, function (i, file) {
                // Type validation
                var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    alert('File "' + file.name + '" is not an allowed type (JPG, PNG, WEBP).');
                    return true; // continue
                }

                // Size validation (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert('File "' + file.name + '" exceeds the 5MB limit.');
                    return true; // continue
                }

                var reader = new FileReader();
                reader.onload = function (e) {
                    $('<img class="tee-photo-preview-item">').attr('src', e.target.result).appendTo(previewGrid);
                }
                reader.readAsDataURL(file);
            });
        }
    });

    $('#tee-submit-lead').on('click', function () {
        var btn = $(this);
        var name = $('#tee-lead-name').val();
        var email = $('#tee-lead-email').val();
        var phone = $('#tee-lead-phone').val();
        var message = $('#tee-lead-message').val();
        var photoInput = $('#tee-lead-photos')[0];

        if (!name || !email || !email.includes('@')) {
            alert('Please enter your name and a valid email address.');
            return;
        }

        var formData = new FormData();
        formData.append('action', 'tee_submit_lead');
        formData.append('nonce', tee_vars.nonce);
        formData.append('name', name);
        formData.append('email', email);
        formData.append('phone', phone);
        formData.append('message', message);
        formData.append('set_number', setData.id);
        formData.append('set_name', setData.name);

        if (photoInput.files.length > 0) {
            $.each(photoInput.files, function (i, file) {
                formData.append('photos[]', file);
            });
        }

        btn.prop('disabled', true).text('Sending...');

        $.ajax({
            url: tee_vars.ajax_url,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function (response) {
                if (response.success) {
                    $('.tee-lead-grid, #tee-submit-lead, #tee-high-value-instruction').hide();
                    $('#tee-lead-success').fadeIn();
                } else {
                    alert(response.data || 'Error submitting quote request.');
                    btn.prop('disabled', false).text('Request Custom Quote');
                }
            },
            error: function () {
                alert('Connection error. Please try again.');
                btn.prop('disabled', false).text('Request Custom Quote');
            }
        });
    });

    function getMetadataString() {
        var parts = [];
        parts.push(userInputs.condition.toUpperCase());
        if (userInputs.condition === 'new') {
            parts.push(userInputs.seals_intact ? 'Seals Intact' : 'Seals Broken');
            if (userInputs.seals_intact) {
                var boxLabel = {
                    'like_new': 'Like New',
                    'fair': 'Fair',
                    'bad': 'Bad'
                }[userInputs.box_condition] || userInputs.box_condition;
                parts.push('Box: ' + boxLabel);
            }
        } else {
            parts.push('Set: ' + (userInputs.completion_level === '100' ? '100% Complete' : (userInputs.completion_level === '95' ? 'Over 95%' : 'Under 95%')));
            parts.push('Built: ' + (userInputs.is_built ? 'Yes' : 'No'));
            parts.push('Box: ' + (userInputs.has_box ? 'Yes' : 'No'));
            parts.push('Instructions: ' + (userInputs.has_instructions ? 'Yes' : 'No'));
        }

        var missingIds = Object.keys(userInputs.missing_minifigs);
        if (missingIds.length > 0) {
            var missingDetails = [];
            missingIds.forEach(function (id) {
                var m = setData.minifigs_data[id];
                var count = userInputs.missing_minifigs[id];
                if (m) {
                    missingDetails.push(m.name + ' (Missing ' + count + ')');
                }
            });
            parts.push('Missing Minifigs: ' + missingDetails.join(', '));
        }

        return parts.join(' | ');
    }

    function renderAgreementList() {
        var container = $('#tee-agreement-items').empty();
        var total = 0;
        var totalWeight = 0;
        var formatter = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        agreementList.forEach(function (item, index) {
            total += parseFloat(item.offer) || 0;
            totalWeight += parseFloat(item.weight) || 0;

            var el = $('<div class="tee-agreement-item">' +
                '<div class="tee-item-info">' +
                '<strong>' + item.name + ' (#' + item.id + ')</strong>' +
                '<span>' + item.metadata + ' | ' + item.weight + 'g</span>' +
                '</div>' +
                '<div style="display:flex; align-items:center;">' +
                '<span class="tee-item-price">£' + formatter.format(item.offer) + '</span>' +
                '<button type="button" class="tee-remove-item" data-index="' + index + '">×</button>' +
                '</div>' +
                '</div>');
            container.append(el);
        });

        $('#tee-agreement-total').text('£' + formatter.format(total));
        $('#tee-agreement-weight').text((totalWeight / 1000).toFixed(2));

        if (agreementList.length > 0) {
            $('#tee-agreement-list-wrap').fadeIn();
        } else {
            $('#tee-agreement-list-wrap').hide();
            $('#tee-sticky-bar').hide();
        }

        $('.tee-remove-item').on('click', function () {
            var idx = $(this).data('index');
            agreementList.splice(idx, 1);
            renderAgreementList();
            updateStickyBar(0);
        });
    }

    // 5. Final Add to Basket
    $('#tee-add-all-to-cart').on('click', function () {
        if (agreementList.length === 0) return;

        var totalWeight = 0;
        agreementList.forEach(function (i) {
            totalWeight += parseFloat(i.weight) || 0;
        });

        if (totalWeight > 18000) {
            alert('Cannot checkout: Total weight exceeds 18KG. Please remove some items.');
            return;
        }

        $(this).prop('disabled', true).html('<span class="dashicons dashicons-update spin"></span> Adding all to basket...');

        // Serial process adding to cart since WC AJAX isn't great with parallel identical product adds
        addBatchToCart(0);
    });

    function addBatchToCart(index) {
        if (index >= agreementList.length) {
            window.location.href = tee_vars.cart_url || '/cart/';
            return;
        }

        var item = agreementList[index];
        $.ajax({
            url: tee_vars.ajax_url,
            type: 'POST',
            data: {
                action: 'tee_add_to_cart',
                nonce: tee_vars.nonce,
                product_id: tee_vars.product_id,
                price: item.offer,
                metadata: {
                    'Set': item.name + ' (' + item.id + ')',
                    'Condition': item.raw_details.condition.toUpperCase(),
                    'Valuation Details': item.metadata,
                    'Weight': item.weight + 'g',
                    'image': item.image
                }
            },
            success: function () {
                addBatchToCart(index + 1);
            }
        });
    }
});

