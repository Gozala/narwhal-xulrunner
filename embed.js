/* Copyright (c) 2006 Irakli Gozalishvili <rfobic@gmail.com>
   See the file LICENSE for licensing information. */
/**
 * @example
 * Components.utils.import('resource://narwhal-xulrunner/embed.js');
 * <script src="resource://narwhal-xulrunner/embed.js"></script>
 */
(function(scope) {
    var narwhal = Components.classes["@narwhaljs.org/xulrunner/global;1"].
        createInstance(Components.interfaces.nsINarwhal).system.global;
    if (scope.window) scope = window;
    else scope.EXPORTED_SYMBOLS = ["global", "require", "print", "system"];
    scope.global = narwhal.global;
    scope.system = narwhal.system;
    scope.print = narwhal.print;
    scope.require = narwhal.require;
})(this)