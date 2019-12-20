const fs = require("fs");
const sysPath = require("path");
const {assert} = require("chai");
const {explore} = require("../");
const series = require("async/series");
const eachOfLimit = require("async/eachOfLimit");
const waterfall = require("async/waterfall");

const assertFilesExist = function(dirname, files, dirs, options, cb) {
    const argv = [dirname];

    switch (arguments.length) {
        case 3:
            cb = dirs;
            dirs = undefined;
            break;
        case 4:
            cb = options;
            options = undefined;
            break;
        default:
            argv[3] = options;
    }

    const filesLen = files.length;
    for (let i = 0; i < filesLen; i++) {
        files[i] = sysPath.join(dirname, files[i]);
    }

    const existingFiles = {};

    // callfile
    argv[1] = (path, stats, next) => {
        if (existingFiles[path]) {
            next(new Error(`explored file '${ path }' twice`));
            return;
        }

        const idx = files.indexOf(path);
        if (idx !== -1) {
            files.splice(idx, 1);
            existingFiles[path] = 1;
        }

        next();
    };

    if (dirs) {
        const dirsLen = dirs.length;
        for (let i = 0; i < dirsLen; i++) {
            dirs[i] = sysPath.join(dirname, dirs[i]);
        }

        const seen_dirs = {};

        // calldir
        argv[2] = (path, stats, dir_files, state, next) => {
            if (state === "end") {
                if (seen_dirs[path]) {
                    next(new Error(`explored directory '${ path }' twice`));
                    return;
                }

                const idx = dirs.indexOf(path);
                if (idx !== -1) {
                    seen_dirs[path] = 1;
                    dirs.splice(idx, 1);
                }
            }

            next();
        };
    }

    // callback
    argv[argv.length] = err => {
        try {
            assert.ifError(err);
            assert.strictEqual(files.length, 0);
            if (dirs) {
                assert.strictEqual(dirs.length, 0);
            }
        } catch ( error ) {
            err = error;
        }
        cb(err);
    };

    switch (argv.length) {
        case 3:
            explore(argv[0], argv[1], argv[2]);
            break;
        case 4:
            explore(argv[0], argv[1], argv[2], argv[3]);
            break;
        default:
            explore(argv[0], argv[1], argv[2], argv[3], argv[4]);
    }
};

describe(require("../package").name, () => {
    it("should explore", cb => {
        assertFilesExist(sysPath.resolve(`${ __dirname }/../node_modules/.bin`), [
            "_mocha",
            "_mocha.cmd",
            "mocha",
            "mocha.cmd"
        ], cb);
    });

    it("should deep explore", cb => {
        assertFilesExist(sysPath.resolve(`${ __dirname }/../node_modules/chai/lib/chai`), [
            sysPath.join("core", "assertions.js"),
            sysPath.join("interface", "assert.js"),
            sysPath.join("interface", "expect.js"),
            sysPath.join("interface", "should.js"),
            sysPath.join("utils", "index.js"),
            sysPath.join("utils", "inspect.js"),
            sysPath.join("utils", "test.js"),
            "assertion.js",
            "config.js"
        ], cb);
    });

    it("should explore files and directories in directory recurse", cb => {
        assertFilesExist(sysPath.resolve(`${ __dirname }/../node_modules/chai/lib/chai`), [
            sysPath.join("core", "assertions.js"),
            sysPath.join("interface", "assert.js"),
            sysPath.join("interface", "expect.js"),
            sysPath.join("interface", "should.js"),
            sysPath.join("utils", "index.js"),
            sysPath.join("utils", "inspect.js"),
            sysPath.join("utils", "test.js"),
            "assertion.js",
            "config.js"
        ], [
            "core",
            "interface",
            "utils"
        ], cb);
    });

    it("should follow symlink", cb => {
        const dir = sysPath.join(__dirname, "dir");
        const sub = "chai"; // link
        const link = sysPath.join(dir, sub);

        const files = [
            sysPath.join(sub, "core", "assertions.js"),
            sysPath.join(sub, "interface", "assert.js"),
            sysPath.join(sub, "interface", "expect.js"),
            sysPath.join(sub, "interface", "should.js"),
            sysPath.join(sub, "utils", "index.js"),
            sysPath.join(sub, "utils", "inspect.js"),
            sysPath.join(sub, "utils", "test.js"),
            sysPath.join(sub, "assertion.js"),
            sysPath.join(sub, "config.js"),
        ];

        const dirs = [
            sub, // link
            sysPath.join(sub, "core"),
            sysPath.join(sub, "interface"),
            sysPath.join(sub, "utils"),
        ];

        series([
            next => {
                fs.unlink(link, err => {
                    fs.rmdir(dir, err => {
                        next();
                    });
                });
            },

            next => {
                fs.mkdir(dir, next);
            },

            next => {
                fs.symlink(sysPath.resolve(`${ __dirname }/../node_modules/chai/lib/chai`), link, "junction", next);
            },

            next => {
                assertFilesExist(dir, files, dirs, {followSymlink: true}, next);
            },
        ], err => {
            series([
                next => {
                    fs.unlink(link, _err => {
                        next();
                    });
                },
                next => {
                    fs.rmdir(dir, _err => {
                        next();
                    });
                }
            ], _err => {
                cb(err);
            });
        });
    });

    it("should not follow symlink", cb => {
        const dir = sysPath.join(__dirname, "dir");
        const sub = "chai"; // link
        const link = sysPath.join(dir, sub);

        const files = [
            sysPath.join(sub, "core", "assertions.js"),
            sysPath.join(sub, "interface", "assert.js"),
            sysPath.join(sub, "interface", "expect.js"),
            sysPath.join(sub, "interface", "should.js"),
            sysPath.join(sub, "utils", "index.js"),
            sysPath.join(sub, "utils", "inspect.js"),
            sysPath.join(sub, "utils", "test.js"),
            sysPath.join(sub, "assertion.js"),
            sysPath.join(sub, "config.js"),
        ];

        const dirs = [
            sub, // link
            sysPath.join(sub, "core"),
            sysPath.join(sub, "interface"),
            sysPath.join(sub, "utils"),
        ];

        const expectFilesLength = files.length;
        const expectDirsLength = dirs.length - 1;

        series([
            next => {
                fs.unlink(link, err => {
                    fs.rmdir(dir, err => {
                        next();
                    });
                });
            },

            next => {
                fs.mkdir(dir, next);
            },

            next => {
                fs.symlink(sysPath.resolve(`${ __dirname }/../node_modules/chai/lib/chai`), link, "junction", next);
            },

            next => {
                assertFilesExist(dir, files, dirs, err => {
                    assert.ok(err);

                    try {
                        assert.strictEqual(files.length, expectFilesLength);
                        assert.strictEqual(dirs.length, expectDirsLength);
                    } catch ( err ) {
                        next(err);
                        return;
                    }

                    next();
                });
            },
        ], err => {
            series([
                next => {
                    fs.unlink(link, _err => {
                        next();
                    });
                },
                next => {
                    fs.rmdir(dir, _err => {
                        next();
                    });
                }
            ], _err => {
                cb(err);
            });
        });
    });

    it("should allow files filtering", cb => {
        const expected = [
            "_mocha",
            "_mocha.cmd",
            "mocha",
            "mocha.cmd"
        ];

        const filtered = expected.filter(file => file[0] !== "_");
        const dirname = sysPath.resolve(`${ __dirname }/../node_modules/.bin`);

        explore(dirname, (path, stats, next) => {
            const idx = filtered.indexOf(path.slice(dirname.length + 1));
            if (idx !== -1) {
                filtered.splice(idx, 1);
            }
            next();
        }, (path, stats, files, state, next) => {
            if (state === "begin") {
                try {
                    assert.deepEqual(files.filter(file => expected.indexOf(file) !== -1).sort(), expected);
                } catch (err) {
                    next(err);
                    return;
                }

                for (let i = files.length - 1; i >= 0; i--) {
                    if (files[i][0] === "_") {
                        files.splice(i, 1);
                    }
                }
            }
            next();
        }, err => {
            if (!err) {
                try {
                    assert.strictEqual(filtered.length, 0);
                } catch (err) {
                    cb(err);
                    return;
                }
            }
            cb(err);
        });
    });

    if (process.env.FS_EXPLORER_REMOTE_TEST) {
        it("should explore a remote directory", function(cb) {
            this.timeout(5000);

            const remoteDir = ".FS_EXPLORER_REMOTE_TEST";
            const remoteBaseIndex = remoteDir.length + 1;

            const {posix: remoteSysPath} = require("path");
            const {Client} = require("ssh2");

            const expectedDirs = [
                "",
                "dir1",
                "dir2",
                "dir3",
            ];

            const expectedFiles = [
                "file",
                remoteSysPath.join("dir1", "file"),
                remoteSysPath.join("dir2", "file"),
                remoteSysPath.join("dir3", "file"),
            ];

            const files = expectedFiles.slice();
            const dirs = expectedDirs.slice();

            const client = new Client();

            client.on("error", cb);

            client.on("ready", () => {
                let sftp;

                waterfall([
                    next => {
                        client.sftp(next);
                    },

                    (_sftp, next) => {
                        sftp = _sftp;
                        eachOfLimit(expectedDirs, 1, (path, index, next) => {
                            sftp.mkdir(remoteSysPath.join(remoteDir, path), next);
                        }, next);
                    },

                    next => {
                        eachOfLimit(expectedFiles, 1, (path, index, next) => {
                            const writable = sftp.createWriteStream(remoteSysPath.join(remoteDir, path));
                            writable.on("error", next);
                            writable.on("finish", next);
                            writable.write("text");
                            writable.end();
                        }, next);
                    },

                    next => {
                        explore(remoteDir, (path, stats, next) => {
                            const idx = files.indexOf(path.slice(remoteBaseIndex));
                            if (idx !== -1) {
                                files.splice(idx, 1);
                            }
                            next();
                        }, (path, stats, remoteFiles, state, next) => {
                            if (state === "begin") {
                                // sftp.readdir return a list of objects instead of a list of string as expected by fs-explorer
                                // transform the list of object files into a list of string
                                remoteFiles.forEach((file, i) => {
                                    if (file !== null && typeof file === "object" && typeof file.filename === "string") {
                                        remoteFiles[i] = file.filename;
                                    }
                                });

                                const baseDir = path.slice(remoteBaseIndex);

                                const idx = dirs.indexOf(baseDir);
                                if (idx !== -1) {
                                    dirs.splice(idx, 1);
                                }
                            }
                            next();
                        }, {
                            fs: sftp,
                            path: remoteSysPath,
                            limit: 8
                        }, next);
                    },

                    next => {
                        eachOfLimit(expectedFiles, 1, (path, index, next) => {
                            sftp.unlink(remoteSysPath.join(remoteDir, path), next);
                        }, next);
                    },

                    next => {
                        eachOfLimit(expectedDirs.reverse(), 1, (path, index, next) => {
                            sftp.rmdir(remoteSysPath.join(remoteDir, path), next);
                        }, next);
                    }
                ], err => {
                    client.end();

                    if (!err) {
                        try {
                            assert.strictEqual(files.length, 0);
                            assert.strictEqual(dirs.length, 0);
                        } catch ( error ) {
                            err = error;
                        }
                    }

                    cb(err);
                });
            });

            client.connect({
                host: process.env.SSH_HOST || "127.0.0.1",
                port: process.env.SSH_PORT ? parseInt(process.env.SSH_PORT, 10) : 22,
                username: process.env.SSH_USERNAME || "anonymous",
                agent: process.env.SSH_AUTH_SOCK || (process.platform === "win32" ? "pageant" : undefined),
            });
        });
    }
});
