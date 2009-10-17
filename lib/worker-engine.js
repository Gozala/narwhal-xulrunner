const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var fs = require("file");

exports.createEnvironment = function createEnvironment() {
    var workerGlobal = Cu.Sandbox(Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal));
    var bootstrap = fs.path(system.enginePrefix).join("bootstrap.js");
    Cu.evalInSandbox(bootstrap.read(), workerGlobal, "1.8", bootstrap.toString(), 0);
    return workerGlobal;
};

