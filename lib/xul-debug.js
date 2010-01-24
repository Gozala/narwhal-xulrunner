var WindowWatcher = Cc["@mozilla.org/embedcomp/window-watcher;1"].getService(Ci.nsIWindowWatcher);

var CONSOLE_URI = "chrome://global/content/console.xul";
var CONFIG_URI = "about:config";

var openWindow = exports.openWindow = function openWindow(url) {
    return WindowWatcher.openWindow(null, url, null, null, null);
}

exports.config = function config() {
    return openWindow(CONFIG_URI);
}
exports.console = function console() {
    return openWindow(CONSOLE_URI);
}

function crop(string, max) {
    max = max || 70;
    string = string.match(/^(.+?)(\n|$)/m)[1];
    return (string.length > max-3) ? string.slice(0, max-3) + '...' : string;
}

exports.inspect = function inspect(object, depth, name) {
    if (depth === undefined) depth = 1;
    if (depth < 1) return;
    if (name == undefined) name = '<' + typeof(object) + '>';
    var result = [];
    var i = 0;
    for (var key in object) {
        if(object instanceof Ci.nsIDOMWindow && (key == "java" || key == "sun" || key == "Packages")) {
            result.push(name + "." + key + "=[not inspecting, dangerous]");
            continue;
        }
        try {
            i++;
            var property = object[key];
            var type = typeof(property);
            if (type == "object") {
                if(object.length !== undefined) result.push(name + "." + key + "=[probably array, length " + object.length + "]");
                else result.push(name + "." + key + "=[" + type + "]");
                var nested = inspect(property, --depth, name + "." + key);
                if (nested) result.push(nested);
            } else if (type == "function") {
                result.push(name + "." + key + "=[function]");
            } else {
                result.push(name + "." + key + "=" + property);
            }
            if (property && typeof property.doc == "string") result.push('    ' + crop(property.doc));
        } catch(e) {
            result.push(name + '.' + key + ' - Exception while inspecting.');
        }
    }
    if(!i) result.push(name + " is empty");
    return result.join("\n");
};


var ARGUMENT_EXTRACTOR = /\s*,\s*/;
var EXTRACTOR = new RegExp(         // (function functionName(foo, bar) {....
    "^" +
    "\\s*" +
    "\\({0,1}" +                    // "("
    "\\s*" +
    "function" +                    // "function"
    "\\s*" +
    "([^\\(\\s]*)" +                // "functionName" - $1 - if not anonymus
    "\\s*" +
    "\\(" +                         // "("
    "([^\\)]*)" +                   // "foo, bar" - $2 - arguments
    "\\s*" +
    "\\)" +                         // ")"
    "\\s*" +
    "\\{" +                         // "{"
    "\\s*" +
    "(\\[native code\\]){0,1}" +      // [native code] - $3 - native method
    "\\s*" +
    "\\/*" +                        // "/" - optional can be comment block
    "\\**" +                        // "*" - optional can be multiline comment
    "\\s*" +
    "\\[{0,1}" +                    // "[" - optional to make it work in firefox comment should be in array
    "\\s*" +
    "((\"|')" +                      // " or ' - $4 - metadoc string opening quote
    "([\\s\\S]*)" +                  // ... - $5 - rest of the source till the last close quote
    "(\"|')){0,1}"
    ,
"m");

var MULTI_SPACES = /\s{2,}/g;
var TRIM_LINES = /\n\s+|\s+\n/g;
var LINE_BREAKS = /\\n|\\\n/g;
var ATTRIBUTES = /\s*\@/g;
var TAG = /^([^\s]+)\s+([\s\S]*)/;

function functionMeta() {
    this.meta = {};
};
functionMeta.prototype.toString = function() {
    var result = [];
    var meta = this.meta;
    var description = meta.description;
    var name = meta.name;
    var displayName = meta.displayName;
    var native = meta.native;
    var params = meta.params;
    var tags = meta.tags;

    if (description) result.push(description);
    if (name) result.push("@name " + name);
    if (displayName) result.push("@displayName " + displayName);
    if (native) result.push("@native");
    if (params) {
        for (var i = 0, l = params.length; i < l; i++ ) {
            result.push("@param " + params[i].name);
        }
    }
    for (var key in tags) {
        var tagGroup = tags[key]
        for (var i = 0, l = tagGroup.length; i < l; i++) {
            var tag = tagGroup[i];
            result.push("@" + tag.name + " " + tag.value);
        }
    }
    return result.join("\n");
};
exports.functionDoc = function doc() {
    ['extracts docs, function name, and params from the function\
    use this function like doc.call(myFunction)\
    extracts will be added to it otherwise new one will be created)\
    @returns {\
        name:String                     Function name\
        native:Boolean                  True if native method\
        params:String[]                 Array of argument names that function expects\
        doc:String                      Documentation string\
    }                                   JSON containing extracts (meta if was passed)\
    @throws Error                       Throws error if first argument is not a function']
    if (typeof this != "function") throw new Error("Function expected");
    var data = new functionMeta();
    var meta = data.meta;
    if (this.displayName) meta.displayName = this.displayName;
    var $ = (this.toSource || this.toString).call(this).match(EXTRACTOR);
    // function name
    if ($[1]) meta.name = $[1];
    // argument names
    var args = $[2].split(ARGUMENT_EXTRACTOR);
    if (args[0] == "") args.pop();
    var paramHash = {};
    var params = meta.params = [];
    for (var i = 0, l = args.length; i < l; i++) {
        var name = args[i];
        params.push(paramHash[name] = { name: name });
    }
    // doc string
    meta.native = !!$[3];
    meta.doc = null;
    var quote = $[5], doctext = $[6];
    if ($[4] && quote && doctext) {
        var slice, extracts = doctext.split(quote);
        var docs = [slice = extracts.shift()];
        while ((slice = extracts.shift()) && slice.charAt(slice.length -1) == "\\")
        docs.push(slice);
        var docs = docs.join("").split(ATTRIBUTES);
        meta.description = docs.shift().replace(LINE_BREAKS, "\n").replace(MULTI_SPACES, " ");
        var tags = meta.tags = {};
        for (var i = 0, l = docs.length; i < l; i ++) {
            var tag = docs[i].match(TAG);
            if (tag) {
                var name = tag[1];
                var value = tag[2];
                (tags[name] = tags[name] || []).push({
                    name: name,
                    value: value
                });
            }
        }
    }
    return data;
}