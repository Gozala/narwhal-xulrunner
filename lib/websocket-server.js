['HTML5 WebSocket Server implementation\
@see http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-31\
@example\
var server = require("websocket-server", true, true).Server({port: 10081, global: true}).start();']

var REQUEST_MATCH = /^GET (\S+){0,1} HTTP\/1\.1$/m;     //in safari path can be omited
var HEADER_MATCH = /^(\S+): (.*)$/m;
var HEADERS = ["Upgrade", "Connection", "WebSocket-Origin", "WebSocket-Location", "WebSocket-Protocol"];
var CR = 0x0D;
var LF = 0x0A;
var FS = 0x00;  // Each frame of data starts with a 0x00 byte
var FE = 0xFF;  // and ends with a 0xFF byte

var console = require("system").log;
var IO = require("io").IO;
var ByteArray = require("binary").ByteArray;

var ServerSocket = CC("@mozilla.org/network/server-socket;1", "nsIServerSocket", "init");
var Pump = CC("@mozilla.org/network/input-stream-pump;1", "nsIInputStreamPump", "init");

exports.run = function(app, options) {
    ['Runs passed app on the server with the a specific settings\
    @param app:Function             Application to run on websocket\
    @param options:JSON             Look at <code>Server</code> for\
    details']
    return Server(options).start(app);
}

var Server = exports.Server = function Server(options) {
    ['WebSocket Server\
    @class\
    @param options:{\
            port:Number = 8080                                 port to listen\
            (origins:String[] = ["127.0.0.1", "localhost"])    Accepted hosts\
            (host:String = "localhost")\
        }\
        server settings\
    ']
    if (!(this instanceof Server)) return new Server(options);
    options = options || {};
    options.port = options.port || 8080;
    options.global = options.global || true;
    this.host = options.host = options.host || "localhost";
    this.options = options;
    this._socket = new ServerSocket(options.port, options.global, -1);
}

Server.prototype = {
    constructor: Server,
    _socket: null,
    handler: null,
    connections: [],
    start: function(app) {
        ['This method puts the server socket in the listening state. It will\
        asynchronously listen for and accept client connections.']
        this._socket.asyncListen(this);
        this.handler = app || WebSocketHandler;
        return this;
    },
    stop: function() {
        ['This method closes a server socket. This does not affect already\
        connected client sockets (i.e., the nsISocketTransport instances\
        created from this server socket). This will cause the onStopListening\
        event to asynchronously fire with a status of NS_BINDING_ABORTED.']
        this.connections.forEach(function(connection) {
            connection.close();
        })
        this._socket.close();
    },
    _add: function(connection) {
        this.connections.push(connection)
    },
    _remove: function(connection) {
        var connections = this.connections;
        var index = connections.indexOf(connection);
        if (index >= 0) connections.splice(index, 1);
    },
    onSocketAccepted: function(socket, transport) {
        ['This method is called when a client connection is accepted.\
        Processes an incoming request coming in on the given socket and contained\
        in the given transport.\
        @param socket:nsIServerSocket           the socket request was served with\
        @param transport:nsISocketTransport     the transport for the request/response\
        @see nsIServerSocketListener.onSocketAccepted']
        try {
            var connection = new Connection(transport, this);
            this._add(connection);
        } catch (e) {
            console.error(e.message, e.stack);
            transport.close(Cr.NS_BINDING_ABORTED);
            return;
        }
    },
    onStopListening: function(server, socket) {
        ['This method is called when the listening socket stops for some reason.\n\
        The server socket is effectively dead after this notification.\
        @param {nsIServerSocket} server             The server socket.\
        @param {nsresult} status                    The reason why the\
            server socket stopped listening.  If the server socket was\
            manually closed, then this value will be NS_BINDING_ABORTED.']
    },
    disconnect: function(connection) {
        ['Triggered when connection is stopped\
        @param {Connection} connection - stopped connection']
        if (!this.options.keepConnections) this._remove(connection);
    },
    get port() {
        ['Port numeber server is litening to']
        return this._socket.port;
    }
};
function Connection(transport, server) {
    ['Client connection that processes an incoming request on the server\
    @param transport:nsISocketTransport     the transport for the request/response\
    @param server:Server                    server connection is esatblished to']
    var inStream = transport.openInputStream(0, 0, 0);
    this.input = new IO(inStream, null);
    this.output = new IO(null, transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0));
    this._transport = transport;
    this.server = server;
    this.port = transport.port;
    this.host = transport.host;
    this.handler = new Handler(this);
    var self = this;
    var pump = new Pump(inStream, -1, -1, 0, 0, false);
    pump.asyncRead({
        onStartRequest: function(request, context) {
            //self.onopen(request);
        },
        onStopRequest: function(request, context, status) {
            self.onclose(status, request);
        },
        onDataAvailable: function(request, context, stream, offset, count) {
            self.onmessage(stream, offset, count);
        }
    }, null);
    this.onopen();
}
Connection.prototype = {
    constructor: Connection,
    transport: null,
    host: null,
    port: null,
    get isAlive() {
        ['Indicates weather or not connection is alive']
        return this._transport.isAlive();
    },
    onopen: function(request) {
        ['callback triggered once socket connection is established']
    },
    onclose: function(status, request) {
        ['callback triggered once connection is being lost / closed\
        on the client side.']
        try {
            this.handler.onclose();
        } catch(e) {
        } finally {
            this.close();
        }
    },
    onmessage: function(stream, offset, count) {
        ['callback triggered when data has arrived']
        this.handler.onmessage();
    },
    close: function() {
        ['closes connection']
        this.server.disconnect(this);
        this.input.close();
        this.output.close();
    }
};

function Handler(connection) {
    ['Creates request handler out of application.\
    @param connection:Connection    request / connection']
    var env = {};
    env["SERVER_NAME"] = connection.server.host;
    var port = env["SERVER_PORT"] = connection.server.port;
    env["HTTP_HOST"] = env["SERVER_NAME"] + ((port == 443 || port == 80) ? "" : ":" + port);
    env["jsgi.output"] = connection.output;
    env["jsgi.input"] = connection.input;
    env["jsgi.version"] = [0,2];
    env["WebSocket-Scheme"] = connection.server.port == 443 ? "wss" : "ws";
    env["WebSocket-Origin"] = env["WebSocket-Scheme"] + "://" + env["HTTP_HOST"]
    env.headers = {};

    var app = {
        env: env,
        close: function close() {
            ['Closes websocket connection with client']
            connection.close();
        }
    };
    connection.server.handler(app);
    return app;
}

var WebSocketHandler = exports.WebSocketHandler = function WebSocketHandler(websocket) {
    ['Default WebSocket handler that takes care of message \
    buffering and fragmentation according to the specs\
    @param websocket:{\
        env:JSON                    env specific properties, headers, path info..\
        onmessage:Function          function that will be triggerd once message arrived\
        (onopen:Function)\
        (onclose:Function)\
        close:Function              closes connection with client\
    }']
    var env = websocket.env;
    var output = env["jsgi.output"];
    var input = env["jsgi.input"];
    var buffer = env.buff = new ByteArray();
    var message = websocket.onmessage;
    var close = websocket.onclose;
    var lastEventId = 0;
    websocket.onmessage = function(event) {
        ['Message handler which take care of buffering & fragmentation. Once\
        fragment is recived it\'s removed from buffer and onmessage trigger is\
        fired']
        var chunk = input.read().toByteArray();
        buffer.push.apply(buffer, env["buffer"].splice(0).concat(chunk).toArray());
        var start, end;
        while (0 <= (start = buffer.indexOf(FS)) < (end = buffer.indexOf(FE))) {
            var length = end - start + 1;
            var data = buffer.splice(start, length).slice(1, length - 1).decodeToString();
            message({
                timeStamp: new Date(),
                data: data,
                lastEventId: lastEventId,
                origin: env["Origin"],
                type: "message"
            });
            lastEventId ++;
        }
    };
    websocket.send = function(data) {
        ['Implements websockets send method. Sends data to the websocket on\
        the client.\
        @param data:String          data to be send']
        var data = new ByteArray(data.toString());
        data.unshift(FS);
        data.push(FE);
        output.write(data);
    };
    websocket.onclose = function() {
        if (close) close({
            timeStamp: new Date(),
            lastEventId: lastEventId,
            origin: env["Origin"],
            type: "close"
        });
    }
    HandsShaker(websocket);
};

var HandsShaker = exports.HandsShaker = function HandsShaker(websocket) {
    ['Additional helper handler to a deafualt Websocket handler.\
    Takes care of handsshaking with client websocket. Once handsshake\
    is done message handler is reasigned back to the original listener\
    usually it\'s WebSocketHandler.']
    var env = websocket.env;
    var headers = env.headers;
    var message = websocket.onmessage;
    var open = websocket.onopen;
    var buffer = new ByteArray();
    websocket.onmessage = function(event) {
        var output = env["jsgi.output"];
        var input = env["buffer"].splice(0).concat(env["jsgi.input"].read().toByteArray());
        buffer.push.apply(buffer, input.toArray());
        try { // looking for the request path
            var line = buffer.splice(0, buffer.indexOf(CR) + 2).decodeToString();
            env["PATH_INFO"] = line.match(REQUEST_MATCH)[1] || "/";
            env["REQUEST_METHOD"] = "GET";
            env["WebSocket-Location"] = env["WebSocket-Origin"] + env["PATH_INFO"];
        } catch(e) {
            console.error(e.message, e.stack);
            throw new Error("Invalid request: " + line);
        }
        // reading the headers
        var length;
        while ((length = buffer.indexOf(CR)) >= 0) {
            try {
                line = buffer.splice(0, length + 2).slice(0, length).decodeToString();
                if (line.length == 0) break;    // All headers are read
                var $ = line.match(HEADER_MATCH);
                headers[$[1]] = $[2];
            } catch(e) {
                console.error(e.message, e.stack);
                throw new Error("invalid request: " + line);
            }
        }
        // Validating headers
        if (headers["Upgrade"] != "WebSocket") throw new Error("Invalid Upgrade: " + headers["Upgrade"]);
        else env["Upgrade"] = headers["Upgrade"];
        if (headers["Connection"] != "Upgrade") throw new Error("Invalid Connection: " + headers["Connection"]);
        else env["Connection"] = headers["Connection"];
        env["WebSocket-Protocol"] = headers["WebSocket-Protocol"];
        env["Origin"] = headers["WebSocket-Origin"] = headers["Origin"];
        headers["WebSocket-Location"] = env["WebSocket-Location"];
        // checks weather or not origin is acceptable id done onopen of the wesocket app
        if (open) open({
            timeStamp: new Date(),
            origin: env["Origin"],
            headres: headers,
            type: "open"
        });
        // Sending server handshake
        var handshake = ["HTTP/1.1 101 Web Socket Protocol Handshake"];
        HEADERS.forEach(function(header) {
            if (headers[header]) handshake.push(header + ": " + headers[header]);
        });
        output.write(handshake.join("\r\n")).write("\r\n\r\n");
        console.debug(handshake.join(" | "));
        websocket.onmessage = message;
    };
};

var FlashSocketPolicyHandler = exports.FlashSocketPolicyHandler = function FlashSocketPolicyHandler(websocket) {
    ['Handler for the flash socket policy files.\
    If request starts with "<" character handler replyes with flash policy\
    xml allowing access to the domains that are in the "Access-Control-Allow-Origin"\
    header, which by default matches origins property of the Server instance. If request\
    strats with any different character call is redirected to the WebSocketHandler.\
    @see http://www.adobe.com/devnet/flashplayer/articles/fplayer9_security_04.html\
    @example\
    var webSocketServer = require("websocket-server", true, true);\
    var server = webSocketServer.Server({port: 10081, global: true}).start(webSocketServer.FlashSocketPolicyHandler);']
    // Stroing WebSocketHandler's onmessage method to redirect on non flash policy requests
    var env = websocket.env;
    WebSocketHandler(websocket);
    var message = websocket.onmessage;
    websocket.onmessage = function(event) {
        var input = env["buffer"] = env["jsgi.input"].read().toByteArray();
        var output = env["jsgi.output"];
        // redirecting if it's not flash policy request
        if (input.get(0) != 60) return message();
        // returning flash policy file
        output.write('<?xml version="1.0"?>\n');
        output.write('<!DOCTYPE cross-domain-policy SYSTEM ');
        output.write('"http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n');
        output.write("<cross-domain-policy>\n");
        output.write('<allow-access-from domain="' + env["SERVER_NAME"] + '" to-ports="' + env["SERVER_PORT"] + '"/>\n');
        output.write('</cross-domain-policy>\n');
        policySent = true;
        websocket.close();
    };
};

