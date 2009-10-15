const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const ThreadManager = Cc["@mozilla.org/thread-manager;1"].getService();

function Message(trigger) {
    this.trigger = trigger;
}
Message.prototype = {
    QueryInterface: function(iid) {
        if (iid.equals(Ci.nsIRunnable) || iid.equals(Ci.nsISupports)) return this;
        throw Components.results.NS_ERROR_NO_INTERFACE;
    },
    run: function() {
        this.trigger();
    }
};

var workerEngine = require("worker-engine");
var Worker = exports.Worker = function Worker(scriptName) {
    var main = ThreadManager.mainThread;
    return createWorker(scriptName, function(thread, global) {
        var worker = createPort(main, global);
        createPort(thread, worker, global);
        return worker;
    });
};

function createPort(thread, target, port) {
    target.onmessage = true; // give it something to feature detect off of
    port = port || {};
    port.postMessage = function(message) {
        try {
            thread.dispatch(new Message(function() {
                var event = {
                    //when is supposed to be the target, and when the ports? The spec is confusing
                    target: target,
                    ports: [target],
                    data: message.toString(),
                }
                if (typeof target.onmessage == "function") target.onmessage(event);
            }), thread.DISPATCH_NORMAL);
        } catch(e) {
            if (typeof target.onerror == "function") target.onerror(e);
            else Components.utils.reportError(e);
        }
    };
    port.postData = function(message) {
        try {
            thread.dispatch(new Message(function() {
                var event = {
                    ports: [target],
                    // this can be optimized to be much faster
                    data: target.JSON.parse(JSON.stringify(message)),
                }
                if (typeof target.ondata == "function") target.ondata(event);
            }), thread.DISPATCH_NORMAL);
        } catch(e) {
            if (typeof target.onerror == "function") target.onerror(e);
            else Components.utils.reportError(e);
        }
    };
    return port;
};


function createWorker(scriptName, setup) {
    var thread = ThreadManager.newThread(0);
    var workerGlobal = workerEngine.createEnvironment();

    // add the module lookup paths from our environment
    var paths = workerGlobal.require.paths;
    paths.splice(0, paths.length);
    paths.push.apply(paths, require.paths);

    // calback for dedicated and shared workers to do their thing
    var worker = setup(thread, workerGlobal);
    worker.terminate = function() {
        thread.shutdown();
    };
    // there must be one and only one shared worker map amongst all workers
    // workerGlobal.require("system").__sharedWorkers__ = system.__sharedWorkers__;

    thread.dispatch(new Message(function() {
            workerGlobal.require(scriptName);
        }), thread.DISPATCH_NORMAL);
    return worker;
};


