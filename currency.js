var Currency = function(id) {
    var self = this;
    if (!(this instanceof Currency)) {
        return new Currency(id);
    }
    this.id = id;
    this.tickerUrl = 'https://api.coinmarketcap.com/v1/ticker/' + this.id + '/';
    this.prices = {};

    this.getTicker = function() {
        return $.ajax({
            url: this.tickerUrl,
        });
    }
    this.getTicker().done(function(data) {
        var ticker = data[0];
        self.name = ticker.name;
        self.symbol = ticker.symbol;
    }).fail(function(jqXHR, textStatus, errorThrown) {
        console.log(jqXHR);
        console.log(textStatus);
        console.log(errorThrown);
    });
}

$.extend(Currency.prototype, {
    getPrice: function(symbol) {
        var self = this;
        return $.ajax({
            url: this.tickerUrl + '?convert=' + symbol
        }).done(function(data) {
            self.prices[symbol.toLowerCase()] = parseFloat(data[0]['price_' + symbol.toLowerCase()]);
        }).fail(function(jqXHR, textStatus, errorThrown) {
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
        });
    }
});

$(function($) {
    $.fn.currencies = function() {
        var self = this;
        var rowTemplate = Handlebars.compile($('#currency-template').html());
        var storageId = 'currencyAppState';
        var state = {};

        var loadCurrencies = function() {
            $.ajax({
                url: 'https://api.coinmarketcap.com/v1/ticker/',
            }).done(function(data) {
                var currencySelect = $('#currency-select');
                currencySelect.empty();
                $.each(data, function(index, value) {
                    currencySelect.append($('<option>', { value: value.id, text: value.name }));
                });
            });
        }

        var addCurrency = function(currencyId, value) {
            var currency = new Currency(currencyId);
            currency.getTicker().done(function(data) {
                var ticker = data[0];
                $('#currency-rows').append(rowTemplate({
                    currency_id: ticker.id,
                    currency_name: ticker.name,
                    currency_symbol: ticker.symbol,
                    currency_price: ticker.price_usd
                }));
                $('#id-' + currencyId).data('currency', currency);
                if (value !== undefined) {
                    $('#id-' + currencyId + ' .currency-owned').val(value);
                    updatePrice(currencyId);
                }
            });
        }

        var removeCurrency = function(currencyId) {
            $('#id-' + currencyId).remove();
            delete state[currencyId];
            updateTotal();
        }

        var updatePrice = function(currencyId) {
            var currency = $('#id-' + currencyId).data('currency');
            currency.getPrice('USD').done(function() {
                var price = currency.prices.usd;
                $('#id-' + currencyId + ' .value .number').html(price);
                var owned = $('#id-' + currencyId + ' .currency-owned').val();
                $('#id-' + currencyId + ' .value .number').html(price * owned);
                updateTotal();
            });
        }

        var updateTotal = function() {
            var totalCol = $('#value-total .number');
            var total = 0.0;
            $('.value .number').each(function() {
                var value = parseFloat($(this).html());
                if (!isNaN(value)) {
                    total += value;
                }
            });
            totalCol.empty();
            totalCol.html(total);
        }

        var updateNet = function(currencyId) {
            var value = parseFloat($('#id-' + currencyId + ' .value .number').html());
            var spent = $('#id-' + currencyId + ' .amount-spent').val();
            $('#id-' + currencyId + ' .net .number').html(value - spent);
        }

        self.loadState = function() {
            state = JSON.parse(localStorage.getItem(storageId));
            $('#currency-rows').empty();
            for (var currency in state) {
                if (state.hasOwnProperty(currency)) {
                    addCurrency(currency, state[currency]);
                }
            }
        }

        self.saveState = function() {
            $('.currency-owned').each(function() {
                var currencyId = $(this).attr('name');
                var owned = parseFloat($(this).val());
                state[currencyId] = owned;
            });
            localStorage.setItem(storageId, JSON.stringify(state));
        }

        loadCurrencies();
        self.loadState();

        $('#refresh-prices').on('click', function() {
            self.loadState();
        });

        return self.on('click', '#add-currency', function() {
            var currencyId = $('#currency-select').val();
            if (!state.hasOwnProperty(currencyId)) {
                addCurrency(currencyId, 0);
                self.saveState();
            } else {
                $('#id-' + currencyId + ' .currency-owned').focus();
            }
        })
        .on('change', '.currency-owned', function() {
            var currencyId = $(this).attr('name');
            self.saveState();
            updatePrice(currencyId);
        })
        .on('change', '.amount-spent', function() {
            var currencyId = $(this).data('id');
            updateNet(currencyId);
        })
        .on('click', '.remove', function() {
            var currencyId = $(this).data('id');
            removeCurrency(currencyId);
            self.saveState();
            return false;
        })
        .on('submit', function() {
            return false;
        });
    }

    $currencyApp = $('#currency-form').currencies();
});
