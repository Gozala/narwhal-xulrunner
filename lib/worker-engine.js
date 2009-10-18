var ThreadManager = Cc["@mozilla.org/thread-manager;1"].getService();

var fs = require("file");

exports.createEnvironment = function createEnvironment() {
    var workerGlobal = Cu.Sandbox(Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal));
    var bootstrap = fs.path(system.enginePrefix).join("bootstrap.js");
    Cu.evalInSandbox(bootstrap.read(), workerGlobal, "1.8", bootstrap.toString(), 0);
    return workerGlobal;
};

exports.spawn = function(functionToRun) {
    var thread = ThreadManager.newThread(0);
    thread.dispatch({
        run: function() {}
    }, thread.DISPATCH_NORMAL);
};

exports.defaultErrorReporter = function(e) {
    Components.utils.reportError(e);
    print(e.name + ": " + e.message);
    if (e.stack) print(e.stack);
};