['Demo module for WebSocket server implementation\
in order to test follow the links see link\
@see http://github.com/gimite/web-socket-js\
@example require("websocket-server").run(hello, { port: 7070 });']

var hello = exports.hello = function(websocket) {
    ['Exameple websocket app. As client side relays\
    on a FlashSocketPolicyHandler, app is useing it']
    websocket.onopen = function() {
        print("On open >>");
    };
    websocket.onclose = function() {
        print("On close <<");
    };
    websocket.onmessage = function(event) {
        print(event.data);
        websocket.send("Hi " + event.data + "!");
   };
   require("websocket-server").FlashSocketPolicyHandler(websocket);
};

exports.main = function() {
    print("starting websocket server");
    require("websocket-server").run(hello, { port: 7070 });
}

if (require.main == module.id) exports.main();