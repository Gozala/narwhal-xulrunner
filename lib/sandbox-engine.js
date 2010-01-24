var fs = require("file");
var systemPrincipal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);

exports.Sandbox = function(options) {
    var paths = options.paths || require.paths;
    var system = options.system || require("system");
    var context = Cu.Sandbox(systemPrincipal);
    var bootstrap = fs.path(system.enginePrefix).join("bootstrap.js");
    Cu.evalInSandbox(bootstrap.read(), context, "1.8", bootstrap.toString(), 0);

    paths.splice(0, paths.length);
    paths.push.apply(paths, paths);
    context.evaluate = function(code, path) {
        return Cu.evalInSandbox(code, context, "1.8", path || "Anonymus", 0);
    }
    return context;
}

