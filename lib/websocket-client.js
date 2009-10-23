var
    // The connection has not yet been established.
    CONNECTING = 0,
    // The Web Socket connection is established and communication is possible.
    OPEN = 1,
    // The connection has been closed or could not be opened.
    CLOSED = 2,
    URL_PARSER = // /^(?:([^:\/?\#]+):)?(?:\/\/([^\/?\#]*))?([^?\#]*)(?:\?([^\#]*))?(?:\#(.*))?/;
    new RegExp( /* url */
    "^" +
    "(?:" +
        "([^:/?#]+):" + /* protocol */
    ")?" +
    "(?:" +
        "(//)" + /* authorityRoot */
        "(" + /* authority */
            "(?:" +
                "(" + /* userInfo */
                    "([^:@]*)" + /* user */
                    ":?" +
                    "([^:@]*)" + /* password */
                ")?" +
                "@" +
            ")?" +
            "([^:/?#]*)" + /* domain */
            "(?::(\\d*))?" + /* port */
        ")" +
    ")?" +
    "(" + /* path */
        "(/?)" + /* root */
        "((?:[^?#/]*/)*)" +
        "([^?#]*)" + /* file */
    ")" +
    "(?:\\?([^#]*))?" + /* query */
    "(?:#(.*))?" /*anchor */
);

const Cc = Components.classes;
const Ci = Components.interfaces;
const TransportService = Cc["@mozilla.org/network/socket-transport-service;1"].
        getService(Ci.nsISocketTransportService);


/**
 * WebSocket class implements the WebSocket interface
 * described in. <a href="http://www.w3.org/TR/websockets/">
 * http://www.w3.org/TR/websockets/</a>
 * @param {String} url
 * @param {String} protocol
 * @example
    var WebSocket = require("websocket").WebSocket;
    var url = "ws://localhost:4444/";
    var socket = new WebSocket(url);
    socket.onopen = function() { print(">>>>>>>") }
    socket.onmessage = function(data) { print("========\n" + data + "\n========") }
    socket.onclose = function() { print("<<<<<<<") }
    socket.send("alert('!!')");
 */
function WebSocket(url, protocol) {
    var fragments = URL_PARSER.exec(url);
    var URL = {
        hash: ["#", fragments[14]].join(""),
        hostname: fragments[7],
        href: fragments[0],
        pathname: fragments[9],
        protocol: fragments[1],
        port: fragments[8],
        search: ["?", fragments[13]].join("")
    };
    URL.host = URL.port ? [URL.hostname, ":", URL.port].join("") : URL.jostname;
    URL.pathname = URL.pathname.length ? URL.pathname : "/";
    var port;

    if (URL.protocol == "ws") port = 80;
    else if (URL.protocol != "wss") port = 443;
    else throw new Error("SYNTAX_ERR");
    URL.port = URL.port || port;
    var origin = "file:";
    try {
        origin = document.location.protocol + document.location.host;
    } catch(e) {}

    var handshake = [
        ["GET", URL.pathname, "HTTP/1.1"].join(" "),
        "Upgrade: WebSocket",
        "Connection: Upgrade",
        ["Host:", URL.hostanme].join(" "),
        ["Origin:", origin].join(" "),
        ["WebSocket-Protocol:", protocol || ""].join(" "),
    ].join("\n");

    this._URL = URL.href;
    this._readyState = CONNECTING;
    var webSocket = this;
    try {
        // Trasnport
        var transport = TransportService.createTransport(null, 0, URL.hostname, URL.port, null);
        // OutStrem
        this._outstream = transport.openOutputStream(0 , 0, 0);
        // InStrema
        var stream = transport.openInputStream(0, 0, 0);
        this._instream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
        this._instream.init(stream, 'UTF-8', 1024, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);
        // pump
        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
        pump.init(stream, -1, -1, 0, 0, false);
        pump.asyncRead({
            onStartRequest: function(request, context) {
                try {
                    webSocket.onopen();
                } finally {
                    webSocket._readyState = OPEN;
                }
            },
            onStopRequest: function(request, context, status) {
                webSocket.close();
            },
            onDataAvailable: function(request, context, inputStream, offset, count) {
                var data = webSocket._instream.read(count);
                if () {
                    webSocket.onmessage();
                }
            }
        }, null);
    } catch(e) {
        this.close();
    }
}
WebSocket.prototype = {
    _URL: null,
    _readyState: null,
    _buffer: "",
    /**
     * readonly attribute DOMString URL
     * @type {String}
     */
    get URL() {
        return this._URL;
    },
    /**
     *
     */
    get readyState() {
        return this._readyState;
    },
    get bufferedAmount() {
        return this._buffer.length;
    },
    /**
     *
     * @param {String} data
     */
    send: function(data) {
        if (this.readyState !== OPEN)
            throw new Error("INVALID_STATE_ERR");
        this._buffer = [this._buffer, data || ""].join("");
        try {
            this._outstream.write(this._buffer, this.bufferedAmount);
            this._buffer = "";
            return true;
        } catch(e) {
            return false;
        }
    },
    /**
     *
     */
    close: function() {
        try {
            this._instream.close();
            this._outstream.close();
            this.onclose();
        } finally {
            this._readyState = CLOSED;
        }
    },
    // default listeners
    onopen: function() {
    },
    onmessage: function() {
    },
    onclose: function() {
    }
};
exports.WebSocket = WebSocket;

