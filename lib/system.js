const Cc = Components.classes;
const Ci = Components.interfaces;

const ENV = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
const MozConsole = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
const DirService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);

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
exports.env = ENV
exports.fs = require('./file');

// default logger
var Logger = require("logger").Logger;
exports.log = new Logger({ write: function(message) {
    print(message);
    MozConsole.logStringMessage(message);
}});