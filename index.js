const {Semaphore} = require("sem-lib");

const emptyFn = Function.prototype;

const defaultOptions = {
    fs: require("fs"),
    path: require("path"),
    resolve: true,
    followSymlink: false
};

/**
 * Explore a file or a directory. i.e. stats
 * Usage
 *     explore(String start, Function callfile)
 *     explore(String start, Function callfile, Function done)
 *     explore(String start, Function callfile, Object options)
 *     explore(String start, Function callfile, Function calldir, Function done)
 *     explore(String start, Function callfile, Function calldir, Object options)
 *     explore(String start, Function callfile, Object options, Function done)
 *     explore(String start, Function callfile, Function calldir, Object options, Function done)
 *
 * Calling next with err cancels the reading
 * Not calling next will make the process hang forever
 * If you want fast reading, call next before processing the file or folder
 * If you want listing control, call next after you processed the file or folder
 * @param  {String}     start    File or folder to read
 * @param  {Function}   callfile called every time a file is encountered with (path, stats, next)
 * @param  {Function}   calldir  called every time a folder is encountered with (path, stats, files, 'begin|end', next). To skip folder, call next(null, true) on begin
 * @param  {Object}     options
 *                         resolve[=true]           returns information about the path symbolic links resolves to.
 *                         followSymlink[=false]    explore the symlink if it resolves to a directory. implies resolve
 *                         limit[=1]                explore multiple paths at time, thus reducing exploration time
 *                         fs[=require("fs")]       filesystem to explore (lstat and readdir methods are used)
 *                         path[=require("path")]   filesystem path. Usually one of {posix, win32} = require("path")
 * @param  {Function}   done     called when there are no more file nor folders to read
 */
function explore(start, callfile, calldir, options, done) {
    const argsLen = arguments.length;

    switch (argsLen) {
        case 0:
        case 1:
            throw new Error("Too few arguments");
        case 2:
            break;
        case 3:
            if (isFunction(calldir)) {
                done = calldir;
            } else if (isObject(calldir)) {
                options = calldir;
            }
            calldir = null;
            break;
        case 4:
            if (isFunction(options)) {
                done = options;
                options = null;
            }

            if (isObject(calldir)) {
                options = calldir;
                calldir = null;
            }
            break;
        default:
            // Nothing to do
    }

    if (!isFunction(callfile)) {
        throw new Error("callfile must be a function");
    }

    options = Object.assign({
        controller: new AbortController()
    }, defaultOptions, options);

    if (isNaN(options.limit) || options.limit <= 0) {
        options.limit = 1;
    }

    options.scheduler = new Semaphore(options.limit, true, 0, true);
    delete options.limit;

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
 * @param  {Function}   callfile called every time a file is encountered with (path, stats, next)
 * @param  {Function}   calldir  called every time a folder is encountered with (path, stats, files, 'begin|end', next)To skip folder, call next(null, true) on begin
 * @param  {Object}     options
 *                         resolve[=true]           returns information about the path symbolic links resolves to.
 *                         followSymlink[=false]    explore the symlink if it resolves to a directory. implies resolve
 * @param  {Function}   done     called when there are no more file nor folders to read
 */
function _explore(start, callfile, calldir, options, done) {
    const {fs: sysFs, followSymlink, resolve} = options;

    sysFs.lstat(start, (err, stats) => {
        if (err) {
            done(err);
            return;
        }

        if (!stats.isSymbolicLink() || (!followSymlink && !resolve)) {
            __doExplore(start, callfile, calldir, options, stats, stats, done);
            return;
        }

        sysFs.realpath(start, (err, realpath) => {
            if (err) {
                done(err);
                return;
            }

            sysFs.lstat(realpath, (err, realStats) => {
                if (err) {
                    // invalid symlink
                    callfile(start, realStats, done);
                    return;
                }

                __doExplore(start, callfile, calldir, options, realStats, stats, done);
            });
        });
    });
}

function __doExplore(start, callfile, calldir, options, realStats, stats, cb) {
    const {fs: sysFs, path: sysPath, followSymlink} = options;

    if (realStats.isFile()) {
        callfile(start, stats, cb);
        return;
    }

    if (realStats.isSymbolicLink() && !followSymlink) {
        callfile(start, stats, cb);
        return;
    }

    if (!realStats.isDirectory()) {
        cb(new Error(`Not a File nor a directory ${ start }`));
        return;
    }

    if (stats.isSymbolicLink() && !followSymlink) {
        const files = [];
        calldir(start, stats, files, "begin", (err, skip) => {
            if (err) {
                cb(err);
                return;
            }

            calldir(start, stats, files, "end", cb);
        });
        return;
    }

    sysFs.readdir(start, (err, files) => {
        if (err) {
            cb(err);
            return;
        }

        calldir(start, stats, files, "begin", (err, skip) => {
            if (err) {
                cb(err);
                return;
            }

            if (skip || files.length === 0) {
                calldir(start, stats, files, "end", cb);
                return;
            }

            const scheduler = options.scheduler instanceof Semaphore ? options.scheduler : new Semaphore(1, true, 0, true);
            const hasTaken = scheduler.getNumTokens() !== scheduler.getCapacity();

            // deeper files have higher priority
            scheduler.schedule(files, {
                priority: -start.split(sysPath.sep).length,
                controller: options.controller,
            }, (file, i, next) => {
                _explore(sysPath.join(start, file), callfile, calldir, options, next);
            }, err => {
                const dirend = () => {
                    if (err) {
                        cb(err);
                    } else {
                        calldir(start, stats, files, "end", cb);
                    }
                };

                // take the given token back
                // so that it will be re-given by the scheduler
                if (hasTaken) {
                    scheduler.semTake({
                        priority: Number.NEGATIVE_INFINITY,
                        onTake: dirend
                    });
                } else {
                    dirend();
                }
            });

            // give the taken token for this task back
            // so that children exploration does not get stuck
            if (hasTaken) {
                scheduler.semGive();
            }
        });
    });
}

function nextFileFn(file, stats, done) {
    done();
}

function nextDirectoryFn(path, stats, files, state, done) {
    done();
}

function isObject(value) {
    return value !== null && typeof value === "object";
}

function isFunction(value) {
    return typeof value === "function";
}

module.exports = {
    explore,
    _explore
};
