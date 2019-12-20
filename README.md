# fs-explorer

Explore a file or a directory

```javascript
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
 *                         resolve[=true]           resolve symlink
 *                         followSymlink[=false]    explore symlink if directory
 *                         limit[=1]                explore multiple paths at time, thus reducing exploration time
 *                         fs[=require("fs")]       filesystem to explore
 *                         path[=require("path")]   filesystem path. Usually one of {posix, win32} = require("path")
 * @param  {Function}   done     called when there are no more file nor folders to read
 */
const {explore} = require('fs-explorer');
explore('/path/to/dir', (path, stats, next) => {
    console.log('file', path);
    next();
}, (path, stats, files, state, next) => {
    if (state === 'end') {
        console.log('directory', path);
    }
    next();
}, {followSymlink: true}, (err) => {
    console.log('done', err);
});
```

Example of remote exploration

```javascript
const {posix: remoteSysPath} = require("path");
const {Client} = require("ssh2");

const client = new Client();

client.on("ready", () => {
    console.log("Client :: ready");

    client.sftp((err, sftp) => {
        if (err) {
            throw err;
        }

        const remoteDir = ".";
        const remoteBaseIndex = remoteDir === "." ? 0 : remoteDir.length + 1;

        explore(remoteDir, (path, stats, next) => {
            console.log("file     ", path);
            next();
        }, (path, stats, files, state, next) => {
            if (state === "end") {
                console.log("directory", path);
            } else {
                const baseDir = path.slice(remoteBaseIndex);

                // do not explore hidden directories
                if (baseDir[0] === "." && baseDir !== ".") {
                    next(null, true);
                    return;
                }

                // limit max exploring depth
                const depth = baseDir.length === 0 ? 0 : baseDir.split(remoteSysPath.sep).length;
                if (depth >= 2) {
                    next(null, true);
                    return;
                }

                // sftp.readdir return a list of objects instead of a list of string as expected by fs-explorer
                // transform the list of object files into a list of string
                files.forEach((file, i) => {
                    if (file !== null && typeof file === "object" && typeof file.filename === "string") {
                        files[i] = file.filename;
                    }
                });
            }
            next();
        }, {
            fs: sftp,
            path: remoteSysPath,
            limit: 32
        }, err => {
            if (err) {
                throw err;
            }
            client.end();
            console.log("done");
        });
    });
});

client.connect({
    host: process.env.SSH_HOST || "127.0.0.1",
    port: process.env.SSH_PORT ? parseInt(process.env.SSH_PORT, 10) : 22,
    username: process.env.SSH_USERNAME || "anonymous",
    agent: process.env.SSH_AUTH_SOCK || (process.platform === "win32" ? "pageant" : undefined),
});
```

# License

The MIT License (MIT)

Copyright (c) 2014-2017 Stéphane MBAPE (http://smbape.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
