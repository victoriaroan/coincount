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
            amount: this.getAmount().toString(),
            cost: this.getCost().toString(),
            date: this.getDate()
        }
    },

    /** Data Functions **/
    getAmount: function() {
        return new Decimal(this.element.find('.amount-input').val() || 0);
    },
    setAmount: function(value) {
        this.element.find('.amount-input').val(value);
        this.element.trigger('ca.trans.updated');
    },
    getCost: function() {
        return new Decimal(this.element.find('.cost-input').val() || 0);
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
    this.expanded = true;

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
        self.expanded = state.expanded;
        if (!self.expanded) {
            self.hideTransactions(self.element.find('a.expand'));
        }
    } else {
        this.addTransaction();
    }

    this.update();

    /** Events **/
    this.element.on('click', 'a.expand', function() {
        if ($(this).hasClass('collapsed')) {
            self.showTransactions($(this));
        } else {
            self.hideTransactions($(this));
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
            self.prices[symbol.toLowerCase()] = new Decimal(data[0]['price_' + symbol.toLowerCase()]);
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
    showTransactions: function(button) {
        this.expanded = true;
        this.element.find('.transaction').show();
        button.removeClass('collapsed').attr('aria-expanded', 'true');
        button.find('span.fa').removeClass('fa-angle-right').addClass('fa-angle-down');
        this.element.trigger('ca.currency.expanded');
    },
    hideTransactions: function(button) {
        this.expanded = false;
        this.element.find('.transaction').hide();
        button.addClass('collapsed').attr('aria-expanded', 'false');
        button.find('span.fa').removeClass('fa-angle-down').addClass('fa-angle-right');
        this.element.trigger('ca.currency.collapsed');
    },

    getBalance: function() {
        return new Decimal(this.element.find('.balance').html() || 0);
    },
    updateBalance: function() {
        var bal = new Decimal(0);
        $.each(this.transactions, function(index, transaction) {
            bal = bal.plus(transaction.getAmount());
        });
        this.element.find('.balance').html(bal.toString());
    },

    getCost: function() {
        return new Decimal(this.element.find('.cost .number').html() || 0);
    },
    updateCost: function(value) {
        var cost = new Decimal(0);
        $.each(this.transactions, function(index, transaction) {
            cost = cost.plus(transaction.getCost());
        });
        this.element.find('.cost .number').html(cost.toString());
    },

    getValue: function() {
        return new Decimal(this.element.find('.value .number').html() || 0);
    },
    updateValue: function() {
        this.element.find('.value .number').html(this.getBalance().times(this.prices.usd).toFixed(2));
    },

    getNet: function() {
        return new Decimal(this.element.find('.net .number').html() || 0);
    },
    updateNet: function() {
        var value = this.getValue();
        var cost = this.getCost();
        var net = value.minus(cost);
        // var net = (value - cost).toFixed(2);
        if (net.lt(0)) {
            this.element.find('.net').addClass('loss');
        } else {
            this.element.find('.net').removeClass('loss');
        }
        this.element.find('.net .number').html(net.abs().toString());
        if (cost.eq(0)) {
            this.element.find('.net .percent').html(100);
        } else {
            this.element.find('.net .percent').html(net.div(cost).times(100).toFixed(2));
        }
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
            transactions: this.transactions,
            expanded: this.expanded
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
            var total = new Decimal(0);
            var cost = new Decimal(0);
            $.each(self.currencies, function() {
                total = total.plus(this.getValue());
                cost = cost.plus(this.getCost());
            });
            var net = total.minus(cost);
            $('#value-total .number').html(total.toFixed(2));
            $('#cost-total .number').html(cost.toFixed(2));
            $('#net-total .number').html(net.toFixed(2));
            $('#net-total .percent').html(net.div(cost).times(100).toFixed(2) || 100);
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
        .on('ca.currency.collapsed', '.currency', self.saveState)
        .on('ca.currency.expanded', '.currency', self.saveState)
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
