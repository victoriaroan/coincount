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
        console.log('hi' + self.id);
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

    this.updateNet = function() {
        var value = this.getValue();
        var cost = this.getCost();
        var net = (value - cost).toFixed(2);
        $(this.elementName + ' .net .number').html(net);
        $(this.elementName + ' .net .percent').html(parseInt(net / cost * 100));
    }
    this.updatePrice = function(callback) {
        var self = this;
        this.getPrice('USD').done(function() {
            var price = self.prices.usd;
            $(self.elementName + ' .price .number').html(price);
            $(self.elementName + ' .value .number').html((price * self.getBalance()).toFixed(2));
            self.updateNet();
            callback();
        });
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
                    currency.updatePrice(updateTotal);
                }
            });
        }

        var removeCurrency = function(currencyId) {
            $('#id-' + currencyId).remove();
            delete self.currencies[currencyId];
            updateTotal();
        }

        var updateNet = function(currencyId) {
            var currency = self.currencies[currencyId];
            currency.updateNet();
            updateTotal();
        }

        var updateTotal = function() {
            var totalEle = $('#value-total .number');
            var costEle = $('#cost-total .number');
            var netEle = $('#net-total .number');
            var gainEle = $('#net-total .percent');
            var total = 0.0;
            var cost = 0.0;
            var net = 0.0;
            $.each(self.currencies, function() {
                total += this.getValue();
                cost += this.getCost();
                net += this.getNet();
            });
            totalEle.html(total.toFixed(2));
            costEle.html(cost.toFixed(2));
            netEle.html(net.toFixed(2));
            gainEle.html(parseInt(net / cost * 100));
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
            $.each(self.currencies, function() {
                this.updatePrice(updateTotal);
            });
            return false;
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
            var currency = self.currencies[currencyId];
            self.saveState();
            currency.updatePrice(updateTotal);
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
