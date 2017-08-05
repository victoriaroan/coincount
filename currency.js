var Transaction = function(id, currencyId) {
    var self = this;
    if (!(this instanceof Transaction)) {
        return new Transaction(id, currencyId);
    }
    this.id = id;
    this.currencyId = currencyId;
    this.elementName = '#id-' + this.currencyId + '-' + this.id;

    this.getElement = function() {
        return $(this.elementName);
    }

    this.toJSON = function() {
        return {
            id: this.id,
            amount: this.getAmount(),
            cost: this.getCost(),
            date: this.getDate()
        }
    }

    /** Data Functions **/
    this.getAmount = function() {
        return parseFloat($(this.elementName + ' .amount-input').val() || 0);
    }
    this.setAmount = function(value) {
        $(this.elementName + ' .amount-input').val(value);
        self.getElement().trigger('ca.trans.updated');
    }
    this.getCost = function() {
        return parseFloat($(this.elementName + ' .cost-input').val() || 0);
    }
    this.setCost = function(value) {
        $(this.elementName + ' .cost-input').val(value);
        self.getElement().trigger('ca.trans.updated');
    }
    this.getDate = function() {
        return $(this.elementName + ' .date-input').val();
    }

    /** Events **/
    $(document).on('change', this.elementName + ' .amount-input', function() {
        self.getElement().trigger('ca.trans.updated');
    });
    $(document).on('change', this.elementName + ' .cost-input', function() {
        self.getElement().trigger('ca.trans.updated');
    });
}

var Currency = function(id, name, symbol, state) {
    var self = this;
    var template = Handlebars.compile($('#currency-template').html());
    if (!(this instanceof Currency)) {
        return new Currency(id);
    }
    this.id = id;
    this.name = name;
    this.symbol = symbol;
    this.tickerUrl = 'https://api.coinmarketcap.com/v1/ticker/' + this.id + '/';
    this.prices = {};
    this.transactions = [];
    this.lastTransactionId = 0;
    this.elementName = '#id-' + this.id;

    this.element = $(template({
        currency_id: self.id,
        currency_name: self.name,
        currency_symbol: self.symbol
    }));
    this.element.data('currency', self);

    if (state !== undefined) {
        // currency.setBalance(state.balance);
        // currency.setCost(state.cost);
        // currency.updatePrice(updateTotal);
        self.element.trigger('ca.currency.loaded');
    } else {
        self.addTransaction();
        self.element.trigger('ca.currency.added');
    }

    self.updatePrice();

    /** Events **/
    $(document).on('click', this.elementName + ' a.add-transaction', function() {
        self.addTransaction();
    });
    $(document).on('click', this.elementName + ' a.t-remove', function() {
        var transactionId = $(this).data('id');
        self.removeTransaction(transactionId);
    });
    $(document).on('ca.trans.updated', this.elementName + ' .transaction', function() {
        self.update();
    });
}

$.extend(Currency.prototype, {
    getTicker: function() {
        var self = this;
        return $.ajax({
            url: self.tickerUrl,
        });
    },
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
    },
    updatePrice: function() {
        var self = this;
        self.getPrice('USD').done(function() {
            $(self.elementName + ' .price .number').html(self.prices.usd);
            self.updateValue();
            self.updateNet();
            self.element.trigger('ca.currency.price.updated');
        });
    },

    getTransaction: function(tId) {
        return $.grep(this.transactions, function (e) { return e.id === tId })[0];
    },
    addTransaction: function() {
        var tId = this.lastTransactionId + 1;
        var transaction = new Transaction(tId, this.id);
        var transactionTemplate = Handlebars.compile($('#transaction-template').html());
        this.lastTransactionId = tId;
        this.transactions.push(transaction);
        this.element.append(transactionTemplate({
            currency_id: this.id,
            transaction_id: tId
        }));
        $(transaction.elementName).data('transaction', transaction);
        $(transaction.elementName + ' .amount-input').focus();
        this.element.trigger('ca.trans.added');
    },
    removeTransaction: function(tId) {
        $('#id-' + this.id + '-' + tId).remove();
        this.transactions = $.grep(this.transactions, function (e) { return e.id !== tId });
        this.update();
        this.element.trigger('ca.trans.removed');
    },

    getBalance: function() {
        return parseFloat($(this.elementName + ' .balance').html() || 0);
    },
    updateBalance: function() {
        var bal = 0;
        $.each(this.transactions, function(index, transaction) {
            bal += transaction.getAmount();
        });
        $(this.elementName + ' .balance').html(bal);
    },

    getCost: function() {
        return parseFloat($(this.elementName + ' .cost .number').html() || 0);
    },
    updateCost: function(value) {
        var cost = 0;
        $.each(this.transactions, function(index, transaction) {
            cost += transaction.getCost();
        });
        $(this.elementName + ' .cost .number').html(cost);
    },

    getValue: function() {
        return parseFloat($(this.elementName + ' .value .number').html() || 0);
    },
    updateValue: function() {
        $(this.elementName + ' .value .number').html((this.prices.usd * this.getBalance()).toFixed(2));
    },

    getNet: function() {
        return parseFloat($(this.elementName + ' .net .number').html() || 0);
    },
    updateNet: function() {
        var value = this.getValue();
        var cost = this.getCost();
        var net = (value - cost).toFixed(2);
        $(this.elementName + ' .net .number').html(net);
        $(this.elementName + ' .net .percent').html(parseInt(net / cost * 100) || 100);
    },

    update: function() {
        this.updateBalance();
        this.updateCost();
        this.updatePrice();
        this.element.trigger('ca.currency.updated');
    },

    toJSON: function() {
        return {
            lastTransactionId: this.lastTransactionId,
            transactions: this.transactions
        }
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
                    currencySelect.append($('<option>', { value: value.id, text: value.name, 'data-name': value.name, 'data-symbol': value.symbol }));
                });
            });
        }

        var addCurrency = function(currencyId, state) {
            var option = $('#currency-select option[value="' + currencyId + '"]');
            var currency = new Currency(currencyId, option.data('name'), option.data('symbol'), state);
            self.currencies[currencyId] = currency;
            $('#currency-table').append(currency.element);
        }

        var removeCurrency = function(currencyId) {
            $('#id-' + currencyId).remove();
            delete self.currencies[currencyId];
            self.trigger('ca.currency.removed');
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
            $.each(self.currencies, function() {
                total += this.getValue();
                cost += this.getCost();
            });
            totalEle.html(total.toFixed(2));
            costEle.html(cost.toFixed(2));
            var net = total - cost;
            netEle.html(net.toFixed(2));
            gainEle.html(parseInt(net / cost * 100) || 100);
        }

        self.loadState = function() {
            var state = JSON.parse(localStorage.getItem(storageId));
            // $('#currency-rows').empty();
            // for (var currency in state) {
            //     if (state.hasOwnProperty(currency)) {
            //         addCurrency(currency, state[currency]);
            //     }
            // }
        }

        self.saveState = function() {
            localStorage.setItem(storageId, JSON.stringify(self.currencies));
        }

        loadCurrencies();
        self.loadState();

        $('#refresh-prices').on('click', function() {
            $.each(self.currencies, function() {
                this.updatePrice();
            });
            return false;
        });

        return self.on('click', '#add-currency', function() {
            var currencyId = $('#currency-select').val();
            if (!self.currencies.hasOwnProperty(currencyId)) {
                addCurrency(currencyId);
            } else {
                // $('#id-' + currencyId + ' .balance-input').focus();
            }
        })
        .on('click', '.remove', function() {
            var currencyId = $(this).data('id');
            removeCurrency(currencyId);
            return false;
        })
        .on('submit', function() {
            return false;
        })
        .on('ca.currency.added', self.saveState)
        .on('ca.currency.removed', function() {
            self.saveState();
            updateTotal();
        })
        .on('ca.currency.updated', '.currency', updateTotal)
        .on('ca.currency.price.updated', '.currency', updateTotal)
        .on('ca.trans.updated', '.transaction', self.saveState)
        .on('ca.trans.removed', '.currency', updateTotal);
    }

    $currencyApp = $('#currency-form').currencies();
});
