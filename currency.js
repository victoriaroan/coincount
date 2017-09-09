var Transaction = function(id, currencyId, state) {
    if (!(this instanceof Transaction)) {
        return new Transaction(id, currencyId);
    }
    var self = this;
    var template = Handlebars.compile($('#transaction-template').html());
    this.id = id;
    this.currencyId = currencyId;
    this.elementName = '#id-' + this.currencyId + '-' + this.id;

    this.element = $(template({
        currency_id: this.currencyId,
        transaction_id: this.id
    }));
    this.element.data('transaction', self);
    if (state !== undefined) {
        this.setAmount(state.amount);
        this.setCost(state.cost);
        this.setDate(state.date);
    }

    /** Events **/
    $(document).on('change', this.elementName + ' .amount-input', function() {
        self.element.trigger('ca.trans.updated');
    });
    $(document).on('change', this.elementName + ' .cost-input', function() {
        self.element.trigger('ca.trans.updated');
    });
    $(document).on('change', this.elementName + ' .date-input', function() {
        self.element.trigger('ca.trans.date.changed');
    });
}

$.extend(Transaction.prototype, {
    toJSON: function() {
        return {
            id: this.id,
            amount: this.getAmount(),
            cost: this.getCost(),
            date: this.getDate()
        }
    },

    /** Data Functions **/
    getAmount: function() {
        return parseFloat(this.element.find('.amount-input').val() || 0);
    },
    setAmount: function(value) {
        this.element.find('.amount-input').val(value);
        this.element.trigger('ca.trans.updated');
    },
    getCost: function() {
        return parseFloat(this.element.find('.cost-input').val() || 0);
    },
    setCost: function(value) {
        this.element.find('.cost-input').val(value);
        this.element.trigger('ca.trans.updated');
    },
    getDate: function() {
        return this.element.find('.date-input').val();
    },
    setDate: function(value) {
        this.element.find('.date-input').val(value);
        this.element.trigger('ca.trans.date.changed');
    }
});

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
        currency_id: this.id,
        currency_name: this.name,
        currency_symbol: this.symbol
    }));
    this.element.data('currency', self);

    if (state !== undefined) {
        self.lastTransactionId = state.lastTransactionId;
        for (var i = 0; i < state.transactions.length; i++) {
            this.addTransaction(state.transactions[i]);
        }
    } else {
        this.addTransaction();
    }

    this.update();

    /** Events **/
    this.element.on('click', 'a.expand', function() {
        if ($(this).hasClass('collapsed')) {
            self.showTransactions();
            $(this).removeClass('collapsed').attr('aria-expanded', 'true');
            $(this).find('span.fa').removeClass('fa-angle-right').addClass('fa-angle-down');
        } else {
            self.hideTransactions();
            $(this).addClass('collapsed').attr('aria-expanded', 'false');
            $(this).find('span.fa').removeClass('fa-angle-down').addClass('fa-angle-right');
        }
    })
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
            self.element.find('.price .number').html(self.prices.usd.toFixed(2));
            self.updateValue();
            self.updateNet();
            self.element.trigger('ca.currency.price.updated');
        });
    },

    getTransaction: function(tId) {
        return $.grep(this.transactions, function (e) { return e.id === tId })[0];
    },
    addTransaction: function(state) {
        if (state !== undefined) {
            var transaction = new Transaction(state.id, this.id, state);
        } else {
            this.lastTransactionId++;
            var transaction = new Transaction(this.lastTransactionId, this.id);
        }
        this.transactions.push(transaction);
        this.element.append(transaction.element);
        this.element.find('.amount-input').focus();
        this.element.trigger('ca.trans.added');
    },
    removeTransaction: function(tId) {
        $('#id-' + this.id + '-' + tId).remove();
        this.transactions = $.grep(this.transactions, function (e) { return e.id !== tId });
        this.update();
        this.element.trigger('ca.trans.removed');
    },
    showTransactions: function() {
        this.element.find('.transaction').show();
    },
    hideTransactions: function() {
        this.element.find('.transaction').hide();
    },

    getBalance: function() {
        return parseFloat(this.element.find('.balance').html() || 0);
    },
    updateBalance: function() {
        var bal = 0.0;
        $.each(this.transactions, function(index, transaction) {
            bal += transaction.getAmount();
        });
        this.element.find('.balance').html(bal);
    },

    getCost: function() {
        return parseFloat(this.element.find('.cost .number').html() || 0);
    },
    updateCost: function(value) {
        var cost = 0;
        $.each(this.transactions, function(index, transaction) {
            cost += transaction.getCost();
        });
        this.element.find('.cost .number').html(cost);
    },

    getValue: function() {
        return parseFloat(this.element.find('.value .number').html() || 0);
    },
    updateValue: function() {
        this.element.find('.value .number').html((this.prices.usd * this.getBalance()).toFixed(2));
    },

    getNet: function() {
        return parseFloat(this.element.find('.net .number').html() || 0);
    },
    updateNet: function() {
        var value = this.getValue();
        var cost = this.getCost();
        var net = (value - cost).toFixed(2);
        if (net < 0) {
            this.element.find('.net').addClass('loss');
        } else {
            this.element.find('.net').removeClass('loss');
        }
        this.element.find('.net .number').html(Math.abs(net));
        this.element.find('.net .percent').html(parseFloat(net / cost * 100).toFixed(2) || 100);
    },

    update: function() {
        this.updatePrice();
        this.updateBalance();
        this.updateCost();
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
            return $.ajax({
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
            if (state !== undefined) {
                self.trigger('ca.currency.loaded');
            } else {
                self.trigger('ca.currency.added');
            }
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
            gainEle.html(parseFloat(net / cost * 100).toFixed(2) || 100);
        }

        self.loadState = function() {
            var state = JSON.parse(localStorage.getItem(storageId));
            for (var currency in state) {
                if (state.hasOwnProperty(currency)) {
                    addCurrency(currency, state[currency]);
                }
            }
        }

        self.saveState = function() {
            localStorage.setItem(storageId, JSON.stringify(self.currencies));
        }

        loadCurrencies().done(function() {
            self.loadState();
        });

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
        .on('ca.currency.loaded', function() {
        })
        .on('ca.currency.removed', function() {
            self.saveState();
            updateTotal();
        })
        .on('ca.currency.updated', '.currency', updateTotal)
        .on('ca.currency.price.updated', '.currency', updateTotal)
        .on('ca.trans.updated', '.transaction', self.saveState)
        .on('ca.trans.date.changed', '.transaction', self.saveState)
        .on('ca.trans.removed', '.currency', function() {
            self.saveState();
            updateTotal();
        });
    }

    $currencyApp = $('#currency-form').currencies();
});
