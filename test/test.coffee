explorer = require '../'
sysPath = require 'path'
fs = require 'fs'
async = require 'async'

assertFilesExist = (dir, files, dirs, options, next) ->
    argv = [dir]

    switch arguments.length
        when 3
            next = dirs
            dirs = undefined
        when 4
            next = options
            options = undefined
        else
            argv[3] = options

    do ->
        for _file, idx in files
            files[idx] = sysPath.join dir, _file
        return

    argv[1] = callfile = (path, stats, next) ->
        if ~(idx = files.indexOf path)
            files.splice idx, 1
        next()
        return

    if dirs
        do ->
            for _dir, idx in dirs
                dirs[idx] = sysPath.join dir, _dir
            return

        argv[2] = calldir = (path, stats, files, state, next)->
            if state is 'end'
                if ~(idx = dirs.indexOf path)
                    dirs.splice idx, 1
            next()
            return

    argv[argv.length] = done = (err)->
        try
            assert.ifError err
            assert.strictEqual files.length, 0
            assert.strictEqual dirs.length, 0 if dirs
        catch err
        next err
        return

    switch argv.length
        when 3
            explorer.explore argv[0], argv[1], argv[2]
        when 4
            explorer.explore argv[0], argv[1], argv[2], argv[3]
        else
            explorer.explore argv[0], argv[1], argv[2], argv[3], argv[4]

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
        assertFilesExist dir, files, done
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
        assertFilesExist dir, files, done
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

    it 'should not follow symlink', (done) ->
        dir = sysPath.join __dirname, 'dir'
        sub = 'chai'
        link = sysPath.join(dir, sub)

        files = [
            sysPath.join sub, 'core', 'assertions.js'
            sysPath.join sub, 'interface', 'assert.js'
            sysPath.join sub, 'interface', 'expect.js'
            sysPath.join sub, 'interface', 'should.js'
            sysPath.join sub, 'utils', 'index.js'
            sysPath.join sub, 'utils', 'inspect.js'
            sysPath.join sub, 'utils', 'test.js'
            sysPath.join sub, 'assertion.js'
            sysPath.join sub, 'config.js'
        ]

        dirs = [
            sub
            sysPath.join sub, 'core'
            sysPath.join sub, 'interface'
            sysPath.join sub, 'utils'
        ]

        expectFilesLength = files.length
        expectDirsLength = dirs.length - 1

        setup = (next)->
            fs.unlink link, (_err)->
                fs.rmdir dir, next
                return
            return

        tearDown = (err)->
            fs.rmdir dir, (_err)->
                console.error(_err) if _err
                done(err)
                return
            return

        setup ->
            fs.mkdir dir, (err)->
                return done(err) if err
                chaiDir = sysPath.resolve __dirname + '/../node_modules/chai/lib/chai'
                fs.symlink chaiDir, link, 'junction', (err)->
                    return tearDown(err) if err
                    assertFilesExist dir, files, dirs, ->
                        fs.unlink link, (_err)->
                            console.error(_err) if _err
                            try
                                assert.strictEqual files.length, expectFilesLength
                                assert.strictEqual dirs.length, expectDirsLength
                            catch err
                            tearDown(err)
                            return
                        return
                    return
                return
            return
        return

    it 'should follow symlink', (done) ->
        dir = sysPath.join __dirname, 'dir'
        sub = 'chai'
        link = sysPath.join(dir, sub)

        files = [
            sysPath.join sub, 'core', 'assertions.js'
            sysPath.join sub, 'interface', 'assert.js'
            sysPath.join sub, 'interface', 'expect.js'
            sysPath.join sub, 'interface', 'should.js'
            sysPath.join sub, 'utils', 'index.js'
            sysPath.join sub, 'utils', 'inspect.js'
            sysPath.join sub, 'utils', 'test.js'
            sysPath.join sub, 'assertion.js'
            sysPath.join sub, 'config.js'
        ]

        dirs = [
            sub
            sysPath.join sub, 'core'
            sysPath.join sub, 'interface'
            sysPath.join sub, 'utils'
        ]

        setup = (next)->
            fs.unlink link, (_err)->
                fs.rmdir dir, next
                return
            return

        tearDown = (err)->
            fs.rmdir dir, (_err)->
                console.error(_err) if _err
                done(err)
                return
            return

        setup ->
            fs.mkdir dir, (err)->
                return done(err) if err
                chaiDir = sysPath.resolve __dirname + '/../node_modules/chai/lib/chai'
                fs.symlink chaiDir, link, 'junction', (err)->
                    return tearDown(err) if err
                    assertFilesExist dir, files, dirs, {followSymlink: true}, (err)->
                        fs.unlink link, (_err)->
                            console.error(_err) if _err
                            tearDown(err)
                            return
                        return
                    return
                return
            return
        return

    return
