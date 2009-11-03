['Narwhal shell module']
var Sandbox = require("sandbox-engine").Sandbox;
var EMPTY_MATCH = /^\s*$/;
var BLOCK_MATCH = /^\s*;\s*$/;
var buffer = "";

exports.shell = function shell(socket) {
    ['Shell service']
    // Stroing WebSocketHandler's onmessage method to redirect on non flash policy requests
    var env = socket.env;
    var buffer = "";
    var input = env["jsgi.input"];
    var output = env["jsgi.output"];
    var terminal = require("term").Stream({
        stdout: output,
        stderr: output
    });
    var sandbox = Sandbox({});
    function repl() {
        terminal.write(Array.prototype.slice.call(arguments).join("\njs> ") + "\n");
    }
    function prompt() {
        terminal.write("js> ");
    }
    function handleError(e) {
        var result = "";
        var realException = e.cause || e;
        if (realException) {
            result += "Details:\n";
            for (var key in realException) {
                var content = String(realException[key]);
                if (content.indexOf('\n') != -1) content = '\n' + content.replace(/^(?!$)/gm, '    ');
                else content = ' ' + content;
                result += '  ' + key + ':' + content.replace(/\s*\n$/m, '');
            }
            result += "\n"
        }
        return result;
    }
    function represent(thing) {
        var result;
        switch(typeof(thing)) {
            case "string":
                result = '"' + thing + '"';
                break;
            case "number":
                result = thing;
                break;
            case "object":
                var names = [];
                for(var name in thing) names.push(name);
                result = thing;
                if (names.length > 0) {
                    result += " - {";
                    result += names.slice(0, 7).map(function(n) {
                        var repr = n + ": ";
                        try {
                            repr += (typeof(thing[n]) == "object" ? "{...}" : represent(thing[n]));
                        } catch(e) {
                            repr += "[Exception!]";
                        }
                        return repr;
                    }).join(", ");
                    if (names.length > 7) result += ", ...";
                    result += "}";
                }
                break;
            case "function":
                var source = thing.toString();
                result = source.substr(0, source.indexOf("\n")) + "...}";
                break;
            default:
                result = thing;
        }
        return result;
    }
    socket.onopen = function() {
       terminal.print("Narwhal Shell 0.1");
       prompt();
    };
    socket.onmessage = function() {
        var chunk = input.read().decodeToString();
        var result;
        if (EMPTY_MATCH.test(chunk)) return prompt();
        if (BLOCK_MATCH.test(chunk)) {
            try {
                result = sandbox.evaluate(chunk);
                if (undefined !== result) repl(represent(result));
                prompt();
            } catch(e) {
                terminal.print(handleError(e));
            }
            buffer = "";
        } else {
            buffer += chunk;
            try {
                result = sandbox.evaluate(buffer);
                if (undefined !== result) repl(represent(result));
                buffer = "";
                prompt();
            } catch(e if e.name == "SyntaxError") {
                terminal.write("  > ");
            } catch(e) {
                terminal.print(handleError(e));
                buffer = "";
            }
        }
    };
};

