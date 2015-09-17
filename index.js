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
 * @param  {Function}   calldir  called every time a folder is encounter with (path[relative to initial start], stats, files, 'start|end', next)
 * @param  {Object}     options  options.resolve[=true] => resolve symlink; options.followSymlink => explore symlink if directory
 * @param  {Function}   done     called when there are no more file nor folders to read
 */
function explore(start, callfile, calldir, options, done) {
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

    if (arguments.length < 2) {
        throw new Error('Too few arguments');
    } else if (arguments.length === 3) {
        done = calldir;
        calldir = null;
    } else if (arguments.length === 4) {
        if ('function' === typeof options) {
            done = options;
            options = null;
        }
    }

    (options && 'object' === typeof options) || (options = {});

    if (typeof callfile !== 'function') {
        callfile = doneFileFn;
    }
    if (typeof calldir !== 'function') {
        calldir = doneDirectoryFn;
    }
    if (typeof done !== 'function') {
        done = emptyFn;
    }

    // Read folder
    take();
    _explore(start, callfile, calldir, options, give /* Folder reading is done */ );

    // Main process is done
    give();
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
 * @param  {Function}   calldir  called every time a folder is encounter with (path[relative to initial start], stats, files, 'start|end', next)
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

        if (stats.isSymbolicLink() && (options.followLink === true || options.resolve !== false)) {
            linkStats = stats;
            try {
                stats = fs.lstatSync(fs.realpathSync(start));
            } catch (err) {
                // invalid symlink
                callfile(start, stats, give);
                return;
            }
        }

        if (stats.isFile()) {
            callfile(start, linkStats || stats, give);
            return;
        }

        if (!stats.isDirectory()) {
            give(new Error('Not a File nor a directory ' + start));
            return;
        }

        stats = linkStats || stats;

        if (stats.isSymbolicLink() && options.followLink !== true) {
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

    });
}

function doneFileFn(file, stats, done) {
    done();
}

function doneDirectoryFn(path, stats, files, state, done) {
    done();
}

function emptyFn() {}