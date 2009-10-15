const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var fs = require("file");

exports.createEnvironment = function createEnvironment() {
    var workerGlobal = Cu.Sandbox(Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal));
    var bootstrapPath = system.enginePrefix + "/bootstrap.js";
    Cu.evalInSandbox(fs.read(bootstrapPath), workerGlobal, "1.8", bootstrapPath, 0);
    return workerGlobal;
};

