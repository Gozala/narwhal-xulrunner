exports.testWorker = require("./test-worker");
if (require.main === module.id)
    require("os").exit(require("test/runner").run(exports));

