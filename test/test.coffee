explorer = require '../'
sysPath = require 'path'
fs = require 'fs'
mkdirp = require 'mkdirp'
async = require 'async'

assertFilesExist = (dir, files, dirs, next) ->
    files = files.slice()
    do ->
        for _file, idx in files
            files[idx] = sysPath.join dir, _file
        return

    if dirs
        dirs = dirs.slice()
        do ->
            for _dir, idx in dirs
                dirs[idx] = sysPath.join dir, _dir
            return

        calldir = (path, stats, files, state, next)->
            if state is 'end'
                if ~(idx = dirs.indexOf path)
                    dirs.splice idx, 1
            next()
            return

    callfile = (path, stats, next) ->
        if ~(idx = files.indexOf path)
            files.splice idx, 1
        next()
        return

    done = (err) ->
        assert.ifError err
        assert.strictEqual files.length, 0
        assert.strictEqual dirs.length, 0 if dirs
        next err
        return

    if calldir
        explorer.explore dir, callfile, calldir, done
    else
        explorer.explore dir, callfile, done
    return

describe 'fs explorer', ->
    it 'should explore files in directory', (done) ->
        files = [
            '_mocha'
            '_mocha.cmd'
            'cake'
            'cake.cmd'
            'coffee'
            'coffee.cmd'
            'mocha'
            'mocha.cmd'
        ]

        dir = sysPath.resolve __dirname + '/../node_modules/.bin'
        assertFilesExist dir, files, null, done
        return

    it 'should explore files in directory recurse', (done) ->
        files = [
            sysPath.join 'core', 'assertions.js'
            sysPath.join 'interface', 'assert.js'
            sysPath.join 'interface', 'expect.js'
            sysPath.join 'interface', 'should.js'
            sysPath.join 'utils', 'index.js'
            sysPath.join 'utils', 'inspect.js'
            sysPath.join 'utils', 'test.js'
            'assertion.js'
            'config.js'
        ]

        dir = sysPath.resolve __dirname + '/../node_modules/chai/lib/chai'
        assertFilesExist dir, files, null, done
        return

    it 'should explore files and directories in directory recurse', (done) ->
        files = [
            sysPath.join 'core', 'assertions.js'
            sysPath.join 'interface', 'assert.js'
            sysPath.join 'interface', 'expect.js'
            sysPath.join 'interface', 'should.js'
            sysPath.join 'utils', 'index.js'
            sysPath.join 'utils', 'inspect.js'
            sysPath.join 'utils', 'test.js'
            'assertion.js'
            'config.js'
        ]

        dirs = [
            'core'
            'interface'
            'utils'
        ]

        dir = sysPath.resolve __dirname + '/../node_modules/chai/lib/chai'
        assertFilesExist dir, files, dirs, done
        return

    return
