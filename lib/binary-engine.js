const Cc = Components.classes;
const Ci = Components.interfaces;
const CC = Components.Constructor;
const BinaryInputStream = CC("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream", "setInputStream");
const BinaryOutputStream = CC("@mozilla.org/binaryoutputstream;1", "nsIBinaryOutputStream", "setOutputStream");
const ScriptableInputStream = CC("@mozilla.org/scriptableinputstream;1", "nsIScriptableInputStream", "init");
const Pipe = CC("@mozilla.org/pipe;1", "nsIPipe", "init");
const ConverterInputStream = CC("@mozilla.org/intl/converter-input-stream;1", "nsIConverterInputStream", "init");
const StringStream = CC("@mozilla.org/io/string-input-stream;1", "nsIStringInputStream", "setData");
const RCHAR = Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER

exports.B_LENGTH = function(bytes) {
    return bytes.length;
}

exports.B_ALLOC = function(length) {
    var bytes = new Array(length);
    for (var i = 0; i < length; i++)
        bytes[i] = 0;
    return bytes;
}

exports.B_FILL = function(bytes, from, to, value) {
    for (var i = from; i < to; i++)
        bytes[i] = value;
}

exports.B_COPY = function(src, srcOffset, dst, dstOffset, length) {
    for (var i = 0; i < length; i++)
        dst[dstOffset+i] = src[srcOffset+i];
}

exports.B_GET = function(bytes, index) {
    var b = bytes[index];
    return (b >= 0) ? b : -1 * ((b ^ 0xFF) + 1);
}

exports.B_SET = function(bytes, index, value) {
    return bytes[index] = (value < 128) ? value : -1 * ((value ^ 0xFF) + 1);
}

exports.B_DECODE = function(bytes, offset, length, codec) {
    var data = {};
    var pipe = new Pipe(false, false, 0, 0, null);
    var bStream = new BinaryOutputStream(pipe.outputStream);
    var cStream = new ConverterInputStream(pipe.inputStream, codec, 0, RCHAR);
    bStream.writeByteArray(bytes.slice(offset, offset + length), length);
    bStream.flush();
    cStream.readString(length, data);
    cStream.close();
    bStream.close();
    return data.value;
}

exports.B_DECODE_DEFAULT = function(bytes, offset, length) {
    return exports.B_DECODE(bytes, offset, length, null);
}

exports.B_ENCODE = function(string, codec) {
    var sStream = new StringStream(string, string.length);
    var cStream = new ConverterInputStream(sStream, codec, 0, RCHAR);
    var bStream = new BinaryInputStream(sStream);
    var bytes = bStream.readByteArray(bStream.available());
    sStream.close();
    bStream.close();
    return bytes;
}

exports.B_ENCODE_DEFAULT = function(string) {
    return exports.B_ENCODE(string, null);
}

exports.B_TRANSCODE = function(bytes, offset, length, sourceCodec, targetCodec) {
    return exports.B_ENCODE(exports.B_DECODE(bytes, offset, length, sourceCodec), targetCodec);
}

