const Cc = Components.classes;
const Ci = Components.interfaces;

var IO = exports.IO = function(inputStream, outputStream) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
};

IO.prototype.read = function(length) {
    var stream = Cc["@mozilla.org/intl/converter-input-stream;1"]
        .createInstance(Ci.nsIConverterInputStream);
    stream.init(this.inputStream, null, 0, 0);

    var data = {}, value = "";
    if (length) stream.readString(length, data)
    else while (stream.readString(4096, data) != 0) value += data.value;
    return value;
}

IO.prototype.copy = function(output, mode, options) {
    var stream = Cc["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Ci.nsIConverterOutputStream);
    stream.init(this.outputStream, null, 0, 0);
    var line = {},
        lines = [],
        haveMore;
    do {
        haveMore = stream.readLine(line);
        stream.writeString(line.value);
    } while(haveMore);
};

IO.prototype.write = function(object, charset) {
    if (object === null || object === undefined || typeof object.toByteString !== "function")
        throw new Error("Argument to IO.write must have toByteString() method");
    var binary = object.toByteString(charset);
    var stream = Cc["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Ci.nsIConverterOutputStream);
    stream.init(this.outputStream, charset || null, 0, 0);
    stream.writeString(binary);
}

IO.prototype.flush = function() {
    this.outputStream.flush();
}

IO.prototype.close = function() {
    if (this.inputStream)
        this.inputStream.close();
    if (this.outputStream)
        this.outputStream.close();
}

IO.prototype.isatty = function() {
    return false;
};



exports.TextInputStream = function(raw, lineBuffering, buffering, charset, options) {
    var stream = Cc["@mozilla.org/intl/converter-input-stream;1"]
            .createInstance(Ci.nsIConverterInputStream);
        stream.init(raw.inputStream, charset || null, buffering || 0, 0);


    var self = this;
    self.readLine = function() {
        stream.QueryInterface(Ci.nsIUnicharLineInputStream);
        var line = {};
        try {
            stream.readLine(line);
        } finally {
            return line.value || "";
        }
    };

    self.iter = function() {
        return self;
    };

    self.next = function() {
        stream.QueryInterface(Ci.nsIUnicharLineInputStream);
        var line = {};
        try {
            stream.readLine(line);
        } finally {
            if (line.value) return line.value;
        }
        throw new Error("StopIteration");
    };

    self.input = function() {
        throw "NYI";
    };

    self.readLines = function() {
        stream.QueryInterface(Ci.nsIUnicharLineInputStream);
        var line = {},
            lines = [],
            haveMore;
        do {
          haveMore = stream.readLine(line);
          lines.push(line.value);
        } while(haveMore);
        return lines;
    };

    self.read = function() {
        stream.QueryInterface(Ci.nsIConverterInputStream);
        var data = {}, value = "";
        while (stream.readString(4096, data) != 0) value += data.value;
        return value;
    };

    self.readInto = function(buffer) {
        throw "NYI";
    };

    self.close = function() {
        stream.close();
    };
};

exports.TextOutputStream = function(raw, lineBuffering, buffering, charset, options) {
    var stream = Cc["@mozilla.org/intl/converter-output-stream;1"]
        .createInstance(Ci.nsIConverterOutputStream);
    stream.init(raw.outputStream, charset || null, buffering || 0, 0);

    var self = this;

    self.raw = raw;

    self.write = function() {
        stream.writeString.apply(stream, arguments);
        return self;
    };

    self.writeLine = function(line) {
        self.write(line + "\n"); // todo recordSeparator
        return self;
    };

    self.writeLines = function(lines) {
        lines.forEach(self.writeLine);
        return self;
    };

    self.print = function() {
        self.write(Array.prototype.join.call(arguments, " ") + "\n");
        self.flush();
        // todo recordSeparator, fieldSeparator
        return self;
    };

    self.flush = function() {
        stream.flush();
        return self;
    };

    self.close = function() {
        stream.close();
        return self;
    };

};

exports.TextIOWrapper = function(raw, mode, lineBuffering, buffering, charset, options) {
    if (mode.update) {
        return new exports.TextIOStream(raw, lineBuffering, buffering, charset, options);
    } else if (mode.write || mode.append) {
        return new exports.TextOutputStream(raw, lineBuffering, buffering, charset, options);
    } else if (mode.read) {
        return new exports.TextInputStream(raw, lineBuffering, buffering, charset, options);
    } else {
        throw new Error("file must be opened for read, write, or append mode.");
    }
};



var StringIO = exports.StringIO = function(initial) {
    var buffer = [];
    if (initial) {
        buffer = buffer.concat(initial.join(""));
    }

    function length() {
        return buffer.length;
    }

    function read(length) {
        var result;

        if (arguments.length == 0) {
            result = buffer.join("");
            buffer = [];
            return result;
        } else {
            if (!length || length < 1)
                length = 1024;
            length = Math.min(buffer.length, length);
            result = buffer.slice(0, length).join("");
            buffer = [];
            return result;
        }
    }

    function write(text) {
        buffer = buffer.concat(text.split(""));
        return self;
    }

    function copy(output) {
        output.write(read()).flush();
        return self;
    }

    function next() {
        var pos, result;
        if (buffer.length === 0) { throw StopIteration; }
        pos = buffer.indexOf("\n");
        if (pos === -1) { pos = buffer.length; }
        result = read(pos);
        read(1);
        return result;
    }

    var self = {
        get length() {
            return length();
        },
        read: read,
        write: write,
        copy: copy,
        close: function() {
            return self;
        },
        flush: function() {
            return self;
        },
        iterator: function() {
            return self;
        },
        forEach: function(block) {
            while (true) {
                try {
                    block.call(this, next());
                } catch (exception) {
                    if (exception instanceof StopIteration)
                        break;
                    throw exception;
                }
            }
        },
        readLine: function() {
            var pos = buffer.indexOf("\n");
            if (pos === -1) { pos = buffer.length; }
            return read(pos + 1);
        },
        next: next,
        print: function(line) {
            return write(line + "\n").flush();
        },
        toString: function() {
            return buffer.join("");
        },
        substring: function() {
            var string = buffer.join("");
            return string.substring.apply(string, arguments);
        },
        slice: function() {
            var string = buffer.join("");
            return string.slice.apply(string, arguments);
        },
        substr: function() {
            var string = buffer.join("");
            return string.substr.apply(string, arguments);
        }
    };
    return self;
};

