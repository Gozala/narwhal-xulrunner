const Cc = Components.classes;
const Ci = Components.interfaces;
const CC = Components.Constructor;
const Pipe = CC("@mozilla.org/pipe;1", "nsIPipe", "init");
const BinaryOutputStream = CC("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream", "setOutputStream");
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream", "setInputStream");
//const StorageStream = CC("@mozilla.org/storagestream;1", "nsIStorageStream", "init");

var BINARY = require("./binary-engine");
var ByteString = require("./binary").ByteString;

var IO = exports.IO = function(inputStream, outputStream) {
    this.inputStream = inputStream;
    this.outputStream = outputStream;
};

IO.prototype.read = function(length) {
    var readAll = (arguments.length == 0);
    if (typeof length !== "number") length = 1024;
    var bytes = this.inputStream.readByteArray(readAll ? this.inputStream.available() : length);
    return new ByteString(bytes, 0, bytes.length);
}

IO.prototype.copy = function(output, mode, options) {
    this.outputStream.writeFrom(this.outputStream, null);
    return this;
};

IO.prototype.write = function(object, charset) {
    if (object === null || object === undefined || typeof object.toByteString !== "function")
        throw new Error("Argument to IO.write must have toByteString() method");
    var binary = object.toByteString(charset);
    var offset = binary._offset;
    var bytes = binary._bytes;
    var length = (this.length = binary.length);
    this.outputStream.writeByteArray(bytes.slice(offset, offset + bytes.length), length);
    return this;
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
        var eof = stream.readLine(line);
        if (eof || line.value) return line.value + "\n";
        return "";
    };

    self.itertor = function () {
        return self;
    };

    self.next = function () {
        stream.QueryInterface(Ci.nsIUnicharLineInputStream);
        var line = {};
        var eof = stream.readLine(line);
        if (eof || line.value) return line.value;
        throw StopIteration;
    };

    self.iterator = function () {
        return self;
    };

    self.forEach = function (block, context) {
        var line;
        while (true) {
            try {
                line = self.next();
            } catch (exception) {
                break;
            }
            block.call(context, line);
        }
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
          lines.push(line.value + "\n");
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

/* ByteIO */

// FIXME: this doesn't read/write the same stream

var ByteIO = exports.ByteIO = function(binary) {
    //var stream = new StorageStream(1024, -1, null);
    var pipe = new Pipe(false, false, 0, 0, null);
    this.outputStream = new BinaryOutputStream(pipe.outputStream);
    this.inputStream = new BinaryInputStream(pipe.inputStream);
    if (binary) {
        var length = this.length = binary.length;
        this.write(binary);
        this.flush();
    }
};

ByteIO.prototype = new exports.IO();

ByteIO.prototype.toByteString = function() {
    var bytes = this.inputStream.readByteArray(this.inputStream.available());
    return new ByteString(bytes, 0, bytes.length);
}

ByteIO.prototype.decodeToString = function(charset) {
    var bytes = this.inputStream.readByteArray(this.inputStream.available());
    var decode = charset ? BINARY.B_DECODE : BINARY.B_DECODE_DEFAULT;
    return decode(bytes, 0, bytes.length, charset)
}


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

