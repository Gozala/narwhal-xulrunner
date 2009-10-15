var assert = require("test/assert");
var Worker = require("worker").Worker;

exports["test - demo"] = function() {
    assert.isEqual(1, 1);
};


if (module.id == require.main)
    require('os').exit(require('test/runner').run(exports));

