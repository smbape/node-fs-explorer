'use strict';

var fs = require('fs'),
    sysPath = require('path');

module.exports = {
    explore: explore,
    _explore: _explore
};

/**
 * Explore a file or a directory. i.e. stats
 * Usage
 *     explore(String start, Function callfile)
 *     explore(String start, Function callfile, Function done)
 *     explore(String start, Function callfile, Function calldir, Function done)
 *     explore(String start, Function callfile, Object options, Function done)
 *     explore(String start, Function callfile, Function calldir, Object options, Function done)
 * 
 * Calling next with err cancels the reading
 * Not calling next will make the process hang forever
 * If you want fast reading, call next before processing the file or folder
 * If you want listing control, call next after you processed the file or folder
 * @param  {String}     start    File or folder to read
 * @param  {Function}   callfile called every time a file is encounter with (path[relative to initial start], stats, next)
 * @param  {Function}   calldir  called every time a folder is encounter with (path[relative to initial start], stats, files, 'begin|end', next). To skip folder, call next(null, true) on begin
 * @param  {Object}     options  options.resolve[=true] => resolve symlink; options.followSymlink => explore symlink if directory
 * @param  {Function}   done     called when there are no more file nor folders to read
 */
function explore(start, callfile, calldir, options, done) {
    var argsLen = arguments.length;

    if (argsLen < 2) {
        throw new Error('Too few arguments');
    } else if (argsLen === 3) {
        done = calldir;
        calldir = null;
    } else if (argsLen === 4) {
        if (isFunction(options)) {
            done = options;
            options = null;
        }
    }

    if (!isFunction(callfile)) {
        throw new Error('callfile must be a function');
    }

    isObject(options) || (options = {});

    if (!isFunction(callfile)) {
        callfile = nextFileFn;
    }

    if (!isFunction(calldir)) {
        calldir = nextDirectoryFn;
    }

    if (!isFunction(done)) {
        done = emptyFn;
    }

    _explore(start, callfile, calldir, options, done);
}

/**
 * Explore a file or a directory with no checking of paramters correctness
 * 
 * Calling next with err cancels the reading
 * Not calling next will make the process hang forever
 * If you want fast reading, call next before processing the file or folder
 * If you want listing control, call next after you processed the file or folder
 * @param  {String}     start    File or folder to read
 * @param  {Function}   callfile called every time a file is encounter with (path[relative to initial start], stats, next)
 * @param  {Function}   calldir  called every time a folder is encounter with (path[relative to initial start], stats, files, 'begin|end', next)To skip folder, call next(null, true) on begin
 * @param  {Object}     options  options.resolve[=true] => resolve symlink; options.followSymlink => explore symlink if directory
 * @param  {Function}   done     called when there are no more file nor folders to read
 */
function _explore(start, callfile, calldir, options, done) {
    var count = 0;

    function take() {
        ++count;
    }

    function give(err) {
        if (--count === 0 || err) {
            done(err);
        }
    }

    // Start process
    take();
    fs.lstat(start, function(err, stats) {
        var linkStats;
        if (err) {
            give(err);
            return;
        }

        if (stats.isSymbolicLink() && (options.followSymlink === true || options.resolve !== false)) {
            linkStats = stats;
            fs.realpath(start, function(err, resolvedPath) {
                if (err) {
                    give(err);
                    return;
                }

                fs.lstat(resolvedPath, function(err, stats) {
                    if (err) {
                        // invalid symlink
                        callfile(start, stats, give);
                        return;
                    }

                    __doExplore(start, callfile, calldir, options, stats, linkStats, take, give);
                });
            });
        } else {
            __doExplore(start, callfile, calldir, options, stats, linkStats, take, give);
        }
    });
}

function __doExplore(start, callfile, calldir, options, stats, linkStats, take, give) {
    if (stats.isFile()) {
        callfile(start, linkStats || stats, give);
        return;
    }

    if (!stats.isDirectory()) {
        give(new Error('Not a File nor a directory ' + start));
        return;
    }

    stats = linkStats || stats;

    if (stats.isSymbolicLink() && options.followSymlink !== true) {
        calldir(start, linkStats || stats, [], 'end', give);
        return;
    }

    fs.readdir(start, function(err, files) {
        var _i = 0,
            _len = files.length;
        if (err) {
            give(err);
            return;
        }

        calldir(start, stats, files, 'begin', next);

        function next(err, skip) {
            if (err) {
                give(err);
                return;
            }

            if (skip || files.length === 0) {
                calldir(start, stats, files, 'end', give);
                return;
            }

            _explore(sysPath.join(start, files[_i]), callfile, calldir, options, iterate);
        }

        function iterate(err, skip) {
            if (err) {
                give(err);
                return;
            }

            if (skip || ++_i === _len) {
                calldir(start, stats, files, 'end', give);
                return;
            }

            _explore(sysPath.join(start, files[_i]), callfile, calldir, options, iterate);
        }
    });
}

function nextFileFn(file, stats, done) {
    done();
}

function nextDirectoryFn(path, stats, files, state, done) {
    done();
}

function emptyFn() {}

// ==============
// From lodash
// ==============
var objToString = Object.prototype.toString

function isObject(value) {
    // Avoid a V8 JIT bug in Chrome 19-20.
    // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
    var type = typeof value;
    return !!value && (type === 'object' || type === 'function');
}

function isFunction(value) {
    // The use of `Object#toString` avoids issues with the `typeof` operator
    // in older versions of Chrome and Safari which return 'function' for regexes
    // and Safari 8 which returns 'object' for typed array constructors.
    return isObject(value) && objToString.call(value) === '[object Function]';
}