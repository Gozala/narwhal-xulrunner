var ENV = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
var MozConsole = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
var DirService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

// Add app and profile directories to the prefixes if they are available
try {
    // application directory
    exports.prefixes.push(DirService.get("resource:app", Ci.nsIFile).path);
    // profile directory
    exports.prefixes.push(DirService.get("ProfD", Ci.nsIFile).path);
} catch(e) {}


var IO = require("./io").IO;
exports.stdin  = null;/*TODO*/
// Temporary hack to simulate stdout
exports.stdout = (function() {
    var buffer = [];
    return {
        write: function(text) {
            buffer.push(text.toString());
            return this;
        },
        flush: function() {
            dump(buffer.join(""));
            buffer = [];
        }
    };
})();

exports.stderr = null;/*TODO*/
exports.args = global.arguments || [];
var env = exports.env = {
    exists: function(name) {
        return ENV.exists(name);
    },
    get: function(name) {
        return ENV.get(name);
    },
    set: function(name, value) {
        return ENV.set(name, value);
    }
};
// Used env variables
[
    "PWD",
    "NARWHAL_HOME",
    "NARWHAL_ENGINE_HOME",
    "JS_PATH",
    "NARWHAL_PATH",
    "SEA",
    "PATH",
    "NARWHAL_DEBUG",
    "NARWHAL_VERBOSE",
//    "NARWHAL_ARGUMENTS"
].forEach(function(variable) {
    if(ENV.exists(variable)) env[variable] = ENV.get(variable);
});

exports.fs = require('./file');

// default logger
var Logger = require("logger").Logger;
exports.log = new Logger({ write: function(message) {
    print(message);
    MozConsole.logStringMessage(message);
}});