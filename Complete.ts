"use strict";

//import * as $ from "jquery";
// php -S localhost:8000 -t C:\Users\Miroslav\Documents\NetBeansProjects\Tests\public_html

// -- -- CONNECTOR -- --

interface IConnectorCallback {
    (arg: Response): void
}

/**
 * Třída zodpovědná za přímou komunikaci se serverem.
 * Do budoucna by konektorů mohlo být více typů, např. AJAX | WAMP.
 */
class Connector {

    /**
     * URL where of server location.
     */
    private serverUrl: string;

    constructor(serverUrl: string) {
        this.serverUrl = serverUrl;
    }

    public connect(): boolean {
        // tohle asi pro AJAX connector nebude nutné, možná jen nějaký test jestli je vůbec server up?
        return true;
    }

    /**
     * @param Request request hi?
     */
    public send(request: Request, callback: IConnectorCallback): void {

        // @todo server is not implemented yet
        let fakeData: any = {
            data: {
                1: 'hello',
                2: 'kitty',
                3: Math.random()
            }
        };
        callback(new ResponseValid(fakeData));
        return;

        // zpracuje se a odešle request
        $.ajax(this.serverUrl, {
            data: request,
            success: function (data: any, textStatus: string, jqXHR: JQueryXHR) {
                callback(new ResponseValid(data));
            },
            error: function (jqXHR: JQueryXHR, textStatus: string, errorThrown: string) {
                callback(new ResponseError({
                    textStatus: textStatus,
                    errorThrown: errorThrown
                }));
            }
        });
    }
}

// -- -- CONTROLLER -- -- 

interface ISetupServer {
    url: string,
    login: string,
    password: string
}
interface ISetupSynchronizer {
    server: string
    urn: string,
    synchronizer: string,
    synchronizeInterval: number,
    synchronizeBy: string
}
interface ISetup {
    servers: {[key: string]: ISetupServer},
    synchronizers: ISetupSynchronizer[]
}

class Controller {

    private setup: ISetup;

    private connectors: {[key: string]: Connector} = {};
    private synchronizers: Synchronizer[] = [];

    public constructor(setup: ISetup) {
        this.setup = setup;

        this.init();

        console.log(this.connectors);
        console.log(this.synchronizers);
    }

    private init(): void {

        // servers init
        if (!this.setup.servers) {
            throw 'At least one server must be defined!';
        }
        for (let serverId in this.setup.servers) {
            let server = this.setup.servers[serverId];

            this.connectors[serverId] = new Connector(server.url);
        }

        // synchronizers init
        for (let synchronizer of this.setup.synchronizers) {
            if (!this.connectors[synchronizer.server]) {
                throw 'Undefined server “' + synchronizer.server + '” for one of synchronizers!';
            }

            let synchronizerConfig: ISynchronizerConfig = {
                connector: this.connectors[synchronizer.server],
                data: {},
                period: synchronizer.synchronizeInterval,
                urn: synchronizer.urn
            };

            this.synchronizers.push(new SynchronizerAppendingFile(synchronizerConfig));
        }
    }

    public start(): void {

        for (let synchronizer of this.synchronizers) {
            synchronizer.synchronize();
        }
    }
}

// -- -- REQUEST -- --

enum ERange {
    RANGE_ALL = 1
}

interface IRange {
    from?: number | string;
    to?: number | string;
}

class Request {
    private range: ERange | IRange;
    private urn: string;

    public constructor(range: ERange | IRange, urn: string) {
        this.range = range;
        this.urn = urn;
    }
}

// -- -- RESPONSE -- --


class Response {
    protected data: any;

    public constructor(data: any) {
        this.data = data;
    }

    public getData() {
        return this.data.data;
    }
}

class ResponseValid extends Response {

    public constructor(data: any) {
        super(data);
    }
}

class ResponseError extends Response {

}


// -- -- SYNCHRONIZER -- --

interface ISynchronizerConfig {
    connector: Connector;
    data: any;
    period: number;
    urn: string;
}

abstract class Synchronizer implements ITimerTickable {

    protected connector: Connector;
    protected data: any;
    protected lastSynchronization: number;
    protected period: number;
    protected request: Request;
    protected requestFirst: boolean = true;
    protected timer: Timer;
    protected urn: string;

    public constructor(config: ISynchronizerConfig) {
        this.connector = config.connector;
        this.data = config.data;
        this.period = config.period;
        this.urn = config.urn;

        this.timer = new Timer(this, this.period);
        this.request = new Request(ERange.RANGE_ALL, this.urn);
    }

    //public abstract init() : Response;

    public abstract synchronize(): void;

    public abstract tick(): void;
}

class SynchronizerAppendingFile extends Synchronizer {

    public constructor(config: ISynchronizerConfig) {
        super(config);
    }

    public synchronize(): void { // @todo void?
        if (this.timer.getState() !== ETimerStates.ticking) {
            this.timer.restart();
        }
    }

    public tick(): void {
        // když se něco vrátí, je potřeba zaznamenat poslední "ID" a dále synchronizovat až od něj
        // @todo use promises?
        this.connector.send(this.request, this.processResponse.bind(this));
    }

    private processResponse(response: Response): void {

        if (response instanceof ResponseValid) {
            // zpracování [nových] zaslaných dat
            this.synchronizeData(response.getData());
        } else if (response instanceof ResponseError) {
            // zpracování chyby
            console.log('-- error returned --');

            //@todo asi nějaký interní try counter, který bude dokola zkoušet synchronize?
        } else {
            // da hell?
            console.log('-- something is wrong--' + typeof response);
        }
    }

    private synchronizeData(data: any) {
        console.log('-- Synchronizing data --');

        for (let lineNumber in data) {
            this.data[lineNumber] = data[lineNumber];
        }

        $('#data').text(JSON.stringify(this.data));
    }
}

// -- -- TIMER -- --

enum ETimerStates {
    stopped, ticking, paused
}

interface ITimerTickable {
    tick: () => void;
}

/**
 * @todo State design pattern?
 * @todo Use JS worker?
 */
class Timer {

    /**
     * Callback that will be called every tick.
     */
    private callback: ITimerTickable;

    /**
     * Given desired interval.
     */
    private interval: number;

    /**
     * Remaining interval used in paused state.
     */
    private intervalRemaining: number;

    /**
     * Timestamp of next wanted tick.
     */
    private timestampTarget: number = null;

    /**
     * JS timeout function ID used for this timer.
     */
    private timeout: number = null;

    /**
     * Minimal time limit for tick skipping. 
     */
    private timeoutFuse: number = 100;

    /**
     * Actual timer state.
     */
    private state: ETimerStates = ETimerStates.stopped;

    public constructor(callback: ITimerTickable, interval: number, timeoutFuse?: number) {
        this.callback = callback;
        this.interval = Math.abs(interval);
        this.timeoutFuse = Math.max(this.timeoutFuse, timeoutFuse | 0);
    }

    public getState(): ETimerStates {
        return this.state;
    }

    /**
     * Calls next cicle and callback. 
     */
    private tick(): void {
        this.cicle();
        this.callback.tick();
    }

    /**
     * Callculates timestamp of next wanted tick and “timestamps”.
     */
    private cicle(): void {
        let
            now = window.performance.now(),
            correctedInterval;

        if (this.timeout === null) {
            correctedInterval = this.interval;
            this.timestampTarget = now + this.interval;
        } else {
            correctedInterval = this.interval - (now - this.timestampTarget);

            this.timestampTarget += this.interval;

            if (correctedInterval < this.timeoutFuse) {
                // skip this tick - missing computational power, or window is inactive
                this.cicle();
                return;
            }
        }

        //        console.log('Now: ' + now + ', timestampTarget: ' + this.timestampTarget + ', correctedInterval: ' + correctedInterval);

        let that = this;
        this.timeout = setTimeout(() => {
            that.tick();
        }, correctedInterval);
    }

    /**
     * Starts timer with desired interval.
     */
    public start(): boolean {
        if (this.state !== ETimerStates.stopped) {
            return false;
        }
        this.state = ETimerStates.ticking;

        this.cicle();

        return true;
    }

    /**
     * Stops timer completely.
     */
    public stop(): boolean {
        clearTimeout(this.timeout);
        this.timeout = null;

        this.state = ETimerStates.stopped;

        return true;
    }

    /**
     * Completely restarts timer.
     */
    public restart(): boolean {
        this.stop();
        this.start();

        return true;
    }

    /**
     * Pauses timer.
     * @todo What if intervalRemaining will be negative, for example in some CPU heavy situations?
     */
    public pause(): boolean {
        if (this.state !== ETimerStates.ticking) {
            return false;
        }
        this.state = ETimerStates.paused;

        clearTimeout(this.timeout);
        this.timeout = null;

        this.intervalRemaining = this.timestampTarget - window.performance.now();

        return true;
    }

    /**
     * Unpauses timer and uses remaining time from last interval.
     * @todo What if intervalRemaining will be negative, for example in some CPU heavy situations?
     */
    public unpause(): boolean {
        if (this.state !== ETimerStates.paused) {
            return false;
        }
        this.state = ETimerStates.ticking;

        this.timestampTarget = window.performance.now() + this.intervalRemaining;

        let that = this;
        this.timeout = setTimeout(() => {
            that.tick();
        }, this.intervalRemaining);

        return true;
    }
}
