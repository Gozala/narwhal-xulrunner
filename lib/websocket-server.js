["''HTML5 WebSocket Server implementation \
@see http://tools.ietf.org/html/draft-hixie-thewebsocketprotocol-31\
@example  var server = require('websocket-server', true, true).Server({port: 10081, global: true}).start();\
''"]

var console = system.log;
var IO = require("io").IO;
var fs = require("file");

var DEFAULT_WEB_SOCKET_PORT = 80;
var DEFAULT_WEB_SOCKET_SECURE_PORT = 443;
var WEB_SOCKET_SCHEME = "ws";
var WEB_SOCKET_SECURE_SCHEME = "wss";

var METHOD_LINE = /^GET ([^ ]+) HTTP\/1.1\r\n$/;

var MANDATORY_HEADERS = [
    // key, expected value or null
    ["Upgrade", "WebSocket"],
    ["Connection", "Upgrade"],
    ["Host", null],
    ["Origin", null],
];

/*
 * @class
 * @param {Number} port
 *      The port of the server socket.  Pass -1 to indicate no preference,
 *      and a port will be selected automatically.
 * @param {Boolean} loopbackOnly
 *      If true, the server socket will only respond to connections on the
 *      local loopback interface.  Otherwise, it will accept connections
 *      from any interface.  To specify a particular network interface,
 *      use initWithAddress.
 * @param {Number} aBackLog
 *      The maximum length the queue of pending connections may grow to.
 *      This parameter may be silently limited by the operating system.
 *      Pass -1 to use the default value.
 */
var ServerSocket = CC("@mozilla.org/network/server-socket;1", "nsIServerSocket", "init");
/**
 * @class
 * @param {nsIInputStream} stream
 *      contains the data to be read.  if the input stream is non-blocking,
 *      then it will be QI'd to nsIAsyncInputStream.  if the QI succeeds
 *      then the stream will be read directly.  otherwise, it will be read
 *      on a background thread using the stream transport service.
 * @param {Number} position
 *      specifies the stream offset from which to start reading.  the
 *      offset value is absolute.  pass -1 to specify the current offset.
 *      NOTE: this parameter is ignored if the underlying stream does not
 *      implement nsISeekableStream.
 * @param {Number} length
 *      specifies how much data to read from the stream.  pass -1 to read
 *      all data available in the stream.
 * @param {Number} segmentSize
 *      if the stream transport service is used, then this parameter
 *      specifies the segment size for the stream transport's buffer.
 *      pass 0 to specify the default value.
 * @param {Number} segmentCount
 *      if the stream transport service is used, then this parameter
 *      specifies the segment count for the stream transport's buffer.
 *      pass 0 to specify the default value.
 * @param closeWhenDone
 *      if true, the input stream will be closed after it has been read.
 */
var Pump = CC("@mozilla.org/network/input-stream-pump;1", "nsIInputStreamPump", "init");
var ScriptableInputStream = CC("@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream", "init");
var ConverterInputStream = CC("@mozilla.org/intl/converter-input-stream;1", "nsIConverterInputStream", "init");


var Server = exports.Server = function Server(options) {
    if (!(this instanceof Server)) return new Server(options);
    options = options || {};
    options.port = options.port || 8080;
    options.global = options.global || false;
    options.acceptedDomains = options.acceptedDomains || ["127.0.0.1", "localhost"];
    this.options = options;
    this._socket = new ServerSocket(options.port, options.global, -1);
}
Server.prototype = {
    constructor: Server,
    _socket: null,
    handler: null,
    /**
     *
     */
    connections: [],
    /**
     * This method puts the server socket in the listening state. It will
     * asynchronously listen for and accept client connections.
     */
    start: function(handler) {
        this._socket.asyncListen(this);
        console.info("starting server");
        this.handler = handler || WebSocketHandler;
        return this;
    },
    /**
     * This method closes a server socket. This does not affect already
     * connected client sockets (i.e., the nsISocketTransport instances
     * created from this server socket). This will cause the onStopListening
     * event to asynchronously fire with a status of NS_BINDING_ABORTED.
     */
    stop: function() {
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
    /**
     * This method is called when a client connection is accepted.
     * Processes an incoming request coming in on the given socket and contained
     * in the given transport.
     *
     * @param {nsIServerSocket} socket              the socket through which the request was served
     * @param {nsISocketTransport} transport        the transport for the request/response
     * @see nsIServerSocketListener.onSocketAccepted
     */
    onSocketAccepted: function(socket, transport) {
        try {
            var connection = new Connection(transport, this);
            this._add(connection);
        } catch (e) {
            console.error(e.message, e.stack);
            transport.close(Cr.NS_BINDING_ABORTED);
            return;
        }
    },
    /**
     * This method is called when the listening socket stops for some reason.
     * The server socket is effectively dead after this notification.
     *
     * @param {nsIServerSocket} server
     *      The server socket.
     * @param {nsresult} status
     *      The reason why the server socket stopped listening.  If the
     *      server socket was manually closed, then this value will be
     *      NS_BINDING_ABORTED.
     */
    onStopListening: function(server, socket) {
    },
    disconnect: function(connection) {
        ["''Triggered when connection is stopped\
        @param {Connection} connection - stopped connection\
        ''"]
        if (!this.options.keepConnections) this._remove(connection);
    },
    get port() {
        return this._socket.port;
    }
};

function Connection(transport, server) {
    var self = this;
    var inStream = transport.openInputStream(0, 0, 0)
    this.input = new IO(inStream, null)
    this.output = new IO(null, transport.openOutputStream(Ci.nsITransport.OPEN_BLOCKING, 0, 0));
    this._transport = transport;
    this.server = server;
    this.port = transport.port;
    this.host = transport.host;
    this.acceptedDomains = server.options.acceptedDomains;
    this.handler = server.handler(process(this));
    var pump = new Pump(inStream, -1, -1, 0, 0, false);
    pump.asyncRead({
        onStartRequest: function(request, context) {
            self.open(request);
        },
        onStopRequest: function(request, context, status) {
            console.info("stop");
            self.close(status, request);
        },
        onDataAvailable: function(request, context, stream, offset, count) {
            self.receive(stream, offset, count);
        }
    }, null);
}
Connection.prototype = {
    constructor: Connection,
    transport: null,
    host: null,
    port: null,
    get live() {
        return this._transport.isAlive();
    },
    open: function(request) {
        
    },
    close: function(status, request) {
        console.info("stop request:", status);
        this.server.disconnect(this);
        this.input.close();
        this.output.close();
    },
    receive: function(stream, offset, count) {
        this.handler();
    }
};

/*
function Handshaker(request) {
    ["''This class performs Web Socket handshake. \
    Handshaker will add attributes such as ws_resource in performing \
    handshake.\
    @param {Connection} request\
    @param {Object} dispatcher\
    ''"]
    this._request = request;
    this._dispatcher = dispatcher;
}
Handshaker.prototype = {
    constructor: Handshaker,
    handshake: function() {
        ["''Perform Web Socket Handshake.''"]
        this._checkHeaderLines();
        this._setResource();
        this._setOrigin()
        this._setLocation()
        this._setProtocol()
        this._dispatcher._extraHandshake(this._request);
        this._send();
    },
    _checkHeaderLines: function() {
        for (var i = 0, l = MANDATORY_HEADERS.length, i < l, i++) {
            var key = MANDATORY_HEADERS[i][0];
            var value = MANDATORY_HEADERS[i][1];
        }
    }
};
*/
function process(connection) {
    var ENV = {};
    ENV["HTTP_HOST"] = connection.server.host + ":" + connection.server.port;
    ENV["SERVER_NAME"] = connection.server.host;
    ENV["SERVER_PORT"] = connection.server.port;
    ENV["SERVER_NAME"] = "moz-ws";
    ENV["Access-Control-Allow-Origin"] = connection.acceptedDomains;
    ENV["jsgi.output"] = connection.output;
    ENV["jsgi.version"] = [0,2];
    ENV["jsgi.url_scheme"] = "ws";    
    function app(env) {
        if (!env) {
            env = ENV;
            env["jsgi.input"] = connection.input.read();
        }
        return env;
    };
    app.terminate = function terminate() {
        connection.close();
    };
    return app;
}

var WebSocketHandler = exports.WebSocketHandler = function WebSocketHandler(app) {
    var buffer = null;
    return function(env) {
        var input = app(env)["jsgi.input"].toByteArray();
        if (this.buffer) this.buffer = this.buffer.concat(input);
        else this.buffer = input;
        console.info("message received:", input.decodeToString());
    }
};

var FlashSocketPolicyHandler = exports.FlashSocketPolicyHandler = function FlashSocketPolicyHandler(app) {
    var webSocketHandler = WebSocketHandler(app);
    return function(env) {
        env = app(env);
        var input = env["jsgi.input"].toByteArray();
        if (input.get(0) == 60) {
            var domains = env["Access-Control-Allow-Origin"];
            var port = env["SERVER_PORT"];
            var output = app(env)["jsgi.output"];
            output.write('<?xml version="1.0"?>\n');
            output.write('<!DOCTYPE cross-domain-policy SYSTEM ');
            output.write('"http://www.macromedia.com/xml/dtds/cross-domain-policy.dtd">\n');
            output.write("<cross-domain-policy>\n");
            for (var i = 0, l = domains.length; i < l; i++)
                output.write('<allow-access-from domain="' + domains[i] + '" to-ports="' + port + '"/>\n');
            output.write('</cross-domain-policy>\n');
            app.terminate();
        } else {
            webSocketHandler(env);
        }
    }
};

