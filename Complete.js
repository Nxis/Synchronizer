"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
/**
 * Třída zodpovědná za přímou komunikaci se serverem.
 * Do budoucna by konektorů mohlo být více typů, např. AJAX | WAMP.
 */
var Connector = (function () {
    function Connector(serverUrl) {
        this.serverUrl = serverUrl;
    }
    Connector.prototype.connect = function () {
        // tohle asi pro AJAX connector nebude nutné, možná jen nějaký test jestli je vůbec server up?
        return true;
    };
    /**
     * @param Request request hi?
     */
    Connector.prototype.send = function (request, callback) {
        // zpracuje se a odešle request
        $.ajax(this.serverUrl, {
            data: request,
            success: function (data, textStatus, jqXHR) {
                callback(new ResponseValid(data));
            },
            error: function (jqXHR, textStatus, errorThrown) {
                callback(new ResponseError({
                    textStatus: textStatus,
                    errorThrown: errorThrown
                }));
            }
        });
    };
    return Connector;
}());
var Controller = (function () {
    function Controller(setup) {
        this.connectors = {};
        this.synchronizers = [];
        this.setup = setup;
        this.init();
        console.log(this.connectors);
        console.log(this.synchronizers);
    }
    Controller.prototype.init = function () {
        // servers init
        if (!this.setup.servers) {
            throw 'At least one server must be defined!';
        }
        for (var serverId in this.setup.servers) {
            var server = this.setup.servers[serverId];
            this.connectors[serverId] = new Connector(server.url);
        }
        // synchronizers init
        for (var _i = 0, _a = this.setup.synchronizers; _i < _a.length; _i++) {
            var synchronizer = _a[_i];
            if (!this.connectors[synchronizer.server]) {
                throw 'Undefined server “' + synchronizer.server + '” for one of synchronizers!';
            }
            var synchronizerConfig = {
                connector: this.connectors[synchronizer.server],
                data: {},
                period: synchronizer.synchronizeInterval,
                urn: synchronizer.urn
            };
            this.synchronizers.push(new SynchronizerAppendingFile(synchronizerConfig));
        }
    };
    Controller.prototype.start = function () {
    };
    return Controller;
}());
// -- -- REQUEST -- --
var ERange;
(function (ERange) {
    ERange[ERange["RANGE_ALL"] = 1] = "RANGE_ALL";
})(ERange || (ERange = {}));
var Request = (function () {
    function Request(range, urn) {
        this.range = range;
        this.urn = urn;
    }
    return Request;
}());
// -- -- RESPONSE -- --
var Response = (function () {
    function Response(data) {
        this.data = data;
    }
    Response.prototype.getData = function () {
        return this.data;
    };
    return Response;
}());
var ResponseValid = (function (_super) {
    __extends(ResponseValid, _super);
    function ResponseValid(data) {
        return _super.call(this, data) || this;
    }
    return ResponseValid;
}(Response));
var ResponseError = (function (_super) {
    __extends(ResponseError, _super);
    function ResponseError() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return ResponseError;
}(Response));
var Synchronizer = (function () {
    function Synchronizer(config) {
        this.requestFirst = true;
        this.connector = config.connector;
        this.data = config.data;
        this.period = config.period;
        this.urn = config.urn;
        this.timer = new Timer(this.synchronize, this.period);
        this.request = new Request(ERange.RANGE_ALL, this.urn);
    }
    return Synchronizer;
}());
var SynchronizerAppendingFile = (function (_super) {
    __extends(SynchronizerAppendingFile, _super);
    function SynchronizerAppendingFile(config) {
        return _super.call(this, config) || this;
    }
    SynchronizerAppendingFile.prototype.synchronize = function () {
        // když se něco vrátí, je potřeba zaznamenat poslední "ID" a dále synchronizovat až od něj
        this.connector.send(this.request, this.processResponse);
        // @todo use promises?
    };
    SynchronizerAppendingFile.prototype.processResponse = function (response) {
        if (typeof response === 'ResponseValid') {
            // zpracování [nových] zaslaných dat
            console.log(response.getData());
        }
        else if (typeof response === 'ResponseError') {
        }
        else {
        }
    };
    return SynchronizerAppendingFile;
}(Synchronizer));
// -- -- TIMER -- --
var ETimerStates;
(function (ETimerStates) {
    ETimerStates[ETimerStates["stopped"] = 0] = "stopped";
    ETimerStates[ETimerStates["ticking"] = 1] = "ticking";
    ETimerStates[ETimerStates["paused"] = 2] = "paused";
})(ETimerStates || (ETimerStates = {}));
/**
 * @todo State design pattern?
 * @todo Use JS worker?
 */
var Timer = (function () {
    function Timer(callback, interval, timeoutFuse) {
        /**
         * Timestamp of next wanted tick.
         */
        this.timestampTarget = null;
        /**
         * JS timeout function ID used for this timer.
         */
        this.timeout = null;
        /**
         * Minimal time limit for tick skipping.
         */
        this.timeoutFuse = 100;
        /**
         * Actual timer state.
         */
        this.state = ETimerStates.stopped;
        this.callback = callback;
        this.interval = Math.abs(interval);
        this.timeoutFuse = Math.max(this.timeoutFuse, timeoutFuse | 0);
    }
    /**
     * Calls next cicle and callback.
     */
    Timer.prototype.tick = function () {
        this.cicle();
        this.callback();
    };
    /**
     * Callculates timestamp of next wanted tick and “timestamps”.
     */
    Timer.prototype.cicle = function () {
        var now = window.performance.now(), correctedInterval;
        if (this.timeout === null) {
            correctedInterval = this.interval;
            this.timestampTarget = now + this.interval;
        }
        else {
            correctedInterval = this.interval - (now - this.timestampTarget);
            this.timestampTarget += this.interval;
            if (correctedInterval < this.timeoutFuse) {
                // skip this tick - missing computational power, or window is inactive
                this.cicle();
                return;
            }
        }
        //        console.log('Now: ' + now + ', timestampTarget: ' + this.timestampTarget + ', correctedInterval: ' + correctedInterval);
        var that = this;
        this.timeout = setTimeout(function () {
            that.tick();
        }, correctedInterval);
    };
    /**
     * Starts timer with desired interval.
     */
    Timer.prototype.start = function () {
        if (this.state !== ETimerStates.stopped) {
            return false;
        }
        this.state = ETimerStates.ticking;
        this.cicle();
        return true;
    };
    /**
     * Stops timer completely.
     */
    Timer.prototype.stop = function () {
        clearTimeout(this.timeout);
        this.timeout = null;
        this.state = ETimerStates.stopped;
        return true;
    };
    /**
     * Completely restarts timer.
     */
    Timer.prototype.restart = function () {
        this.stop();
        this.start();
        return true;
    };
    /**
     * Pauses timer.
     * @todo What if intervalRemaining will be negative, for example in some CPU heavy situations?
     */
    Timer.prototype.pause = function () {
        if (this.state !== ETimerStates.ticking) {
            return false;
        }
        this.state = ETimerStates.paused;
        clearTimeout(this.timeout);
        this.timeout = null;
        this.intervalRemaining = this.timestampTarget - window.performance.now();
        return true;
    };
    /**
     * Unpauses timer and uses remaining time from last interval.
     * @todo What if intervalRemaining will be negative, for example in some CPU heavy situations?
     */
    Timer.prototype.unpause = function () {
        if (this.state !== ETimerStates.paused) {
            return false;
        }
        this.state = ETimerStates.ticking;
        this.timestampTarget = window.performance.now() + this.intervalRemaining;
        var that = this;
        this.timeout = setTimeout(function () {
            that.tick();
        }, this.intervalRemaining);
        return true;
    };
    return Timer;
}());
