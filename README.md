fs-explorer
=======
Explore a file or a directory

```javascript
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
var explore = require('fs-explorer').explore;
explore('/path/to/dir', function(path, stats, next) {
    console.log('file', path);
    next();
}, function(path, stats, files, state, next) {
    if (state === 'end') {
        console.log('directory', path);
    }
    next();
}, {followSymlink: true}, function(err) {
    console.log('done', err);
});
```