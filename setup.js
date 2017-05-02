
let setup = {
    servers: {
        local: {
            url: 'http://localhost:8000/server.php',
            login: 'test@example.com',
            password: 'password'
        }
    },
    synchronizers: [
        {
            server: 'local', // který server se má použít
            urn: '/fileAppending/log1.log',
            synchronizer: 'appendingFile', // logFile? / obsaženo v URN?
            synchronizeInterval: 3000, // jak často se má synchronizovat / načítat
            synchronizeBy: 'lineNumber', // pro file synchronizer bude výchozí hodnota?
            //preload: true,
            //preload: 3600
        }/*,
        {
            server: 'local', // který server se má použít
            urn: '/files/log2.log',
            synchronizer: 'appendingFile', // logFile?
            synchronizeInterval: 60, // jak často se má synchronizovat / načítat
            synchronizeBy: 'lineNumber', // pro file synchronizer bude výchozí hodnota?
            //preload: true,
            //preload: 3600
        }*/
    ]
};

let controller = new Controller(setup);
controller.start();

/*
 function callback() {
 console.log('--CALLBACK--');
 console.log(arguments);
 }
 
 
 
 
 var
 request = new Request(1, '/test/'),
 connector = new Connector('http://localhost:8000/server.php');
 
 connector.send(request, callback);
 */