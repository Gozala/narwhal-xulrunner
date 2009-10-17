const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const ThreadManager = Cc["@mozilla.org/thread-manager;1"].getService();

exports.enqueue = function(task) {
    var thread = ThreadManager.currentThread;
    thread.dispatch({
        run: function() {
            thread.pushEventQueue(null);
            task();
            thread.popEventQueue();
        }
    }, thread.DISPATCH_NORMAL);
};

