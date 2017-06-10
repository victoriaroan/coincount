var Currency = function(id) {
    var self = this;
    if (!(this instanceof Currency)) {
        return new Currency(id);
    }
    this.id = id;
    this.tickerUrl = 'https://api.coinmarketcap.com/v1/ticker/' + this.id + '/';
    this.prices = {};
    this.elementName = '#id-' + this.id;

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

    this.getElement = function() {
        return $(this.elementName);
    }
    this.getBalance = function() {
        return parseFloat($(this.elementName + ' .balance-input').val() || 0);
    }
    this.setBalance = function(value) {
        return $(this.elementName + ' .balance-input').val(value);
    }
    this.getCost = function() {
        return parseFloat($(this.elementName + ' .cost-input').val() || 0);
    }
    this.setCost = function(value) {
        return $(this.elementName + ' .cost-input').val(value);
    }
    this.getValue = function() {
        return parseFloat($(this.elementName + ' .value .number').html() || 0);
    }
    this.getNet = function() {
        return parseFloat($(this.elementName + ' .net .number').html() || 0);
    }
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

        self.currencies = {};

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

        var addCurrency = function(currencyId, state) {
            var currency = new Currency(currencyId);
            self.currencies[currencyId] = currency;
            currency.getTicker().done(function(data) {
                var ticker = data[0];
                $('#currency-rows').append(rowTemplate({
                    currency_id: ticker.id,
                    currency_name: ticker.name,
                    currency_symbol: ticker.symbol,
                    currency_price: ticker.price_usd
                }));
                $('#id-' + currencyId).data('currency', currency);
                if (state !== undefined) {
                    currency.setBalance(state.balance);
                    currency.setCost(state.cost);
                    updatePrice(currencyId);
                }
            });
        }

        var removeCurrency = function(currencyId) {
            $('#id-' + currencyId).remove();
            delete self.currencies[currencyId];
            updateTotal();
        }

        var updatePrice = function(currencyId) {
            var currency = self.currencies[currencyId];
            currency.getPrice('USD').done(function() {
                var price = currency.prices.usd;
                $('#id-' + currencyId + ' .price .number').html(price);
                var balance = currency.getBalance();
                $('#id-' + currencyId + ' .value .number').html((price * balance).toFixed(2));
                updateNet(currencyId);
                updateTotal();
            });
        }

        var updateNet = function(currencyId) {
            var currency = self.currencies[currencyId];
            var value = parseFloat($('#id-' + currencyId + ' .value .number').html());
            var cost = currency.getCost();
            $('#id-' + currencyId + ' .net .number').html((value - cost).toFixed(2));
            updateTotal();
        }

        var updateTotal = function() {
            var totalCol = $('#value-total .number');
            var costCol = $('#cost-total .number');
            var netCol = $('#net-total .number');
            var total = 0.0;
            var cost = 0.0;
            var net = 0.0;
            $.each(self.currencies, function() {
                total += this.getValue();
                cost += this.getCost();
                net += this.getNet();
            });
            totalCol.html(total.toFixed(2));
            costCol.html(cost.toFixed(2));
            netCol.html(net.toFixed(2));
        }

        self.loadState = function() {
            var state = JSON.parse(localStorage.getItem(storageId));
            $('#currency-rows').empty();
            for (var currency in state) {
                if (state.hasOwnProperty(currency)) {
                    addCurrency(currency, state[currency]);
                }
            }
        }

        self.saveState = function() {
            var state = {};
            $.each(self.currencies, function() {
                state[this.id] = {
                    balance: this.getBalance(),
                    cost: this.getCost()
                }
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
            if (!self.currencies.hasOwnProperty(currencyId)) {
                addCurrency(currencyId, 0);
                self.saveState();
            } else {
                $('#id-' + currencyId + ' .balance-input').focus();
            }
        })
        .on('change', '.balance-input', function() {
            var currencyId = $(this).attr('name');
            self.saveState();
            updatePrice(currencyId);
        })
        .on('change', '.cost-input', function() {
            var currencyId = $(this).data('id');
            self.saveState();
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
