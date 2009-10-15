var fs = require("file");
onmessage = function(event) {
    var n = parseInt(event.data);

    for (var i = 1; i < n; i++) {
        postMessage(i);
    }
};

