import { Event, Uri, workspace } from 'vscode';
import * as Path from 'path';
import * as SvnService from './SvnService';
import * as Display from './Display';

import * as fs from 'fs';

export function mapEvent(event, map) {
    return (listener, thisArgs, disposables) => event(i => listener.call(thisArgs, map(i)), null, disposables);
}

// normalize function for turning windows paths into
// something comparable before and after processing
export function normalize(path) {
    path = path.replace(/\\\\/g, '/');
    path = path.replace(/\\/g, '/');
    const matches = /([A-Z]):(.*)/.exec(path);
    if (matches) {
        path = `${matches[1].toLowerCase()}:${matches[2]}`;
    }
    return path;
}

// Use ASCII expansion for special characters
export function expansePath(path) {
    if (workspace.getConfiguration('svn').get('realpath', false)) {
        if (fs.existsSync(path)) {
            path = fs.realpathSync(path);
        }
    }

    const fixup = path.replace(/%/g, '%25').replace(/\*/g, '%2A').replace(/#/g, '%23').replace(/@/g, '%40');
    const relativeToRoot = SvnService.convertToRel(fixup);
    return relativeToRoot;
}

export function processInfo(output) {
    const map = new Map();
    const lines = output.trim().split('\n');

    for (let i = 0, n = lines.length; i < n; ++i) {
        // Property Name: Property Value
        const matches = lines[i].match(/([^:]+): (.+)/);

        if (matches) {
            map.set(matches[1], matches[2]);
        }

    }

    return map;
}

export function isLoggedIn(compatibilityMode) {
    return new Promise((resolve, reject) => {
        if (compatibilityMode === 'sourcedepot') {
            resolve(true);
            return;
        }

        SvnService.execute('login', (err, stdout, stderr) => {
            err && Display.showError(err.toString());
            stderr && Display.showError(stderr.toString());
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(true);
            }
        }, '-s');
    });
}

// Get a string containing the output of the command
export function getOutput(command, file, revision, prefixArgs, gOpts, input) {
    return new Promise((resolve, reject) => {
        let args = prefixArgs != null ? prefixArgs : '';

        if (gOpts != null) {
            command = gOpts + ' ' + command;
        }

        var revisionString = revision == null || isNaN(revision) ? '' : `#${revision}`;

        if (file) {
            let path = (typeof file === 'string') ? file : file.fsPath;
            path = expansePath(path);

            args += ' "' + path + revisionString + '"';
        }

        SvnService.execute(command, (err, stdout, stderr) => {
            err && Display.showError(err.toString());
            stderr && Display.showError(stderr.toString());
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(stdout);
            }
        }, args, null, input);
    });
}

// Get a path to a file containing the output of the command
export function getFile(command, localFilePath, revision, prefixArgs) {
    return new Promise((resolve, reject) => {
        var args = prefixArgs != null ? prefixArgs : '';

        var ext = Path.extname(localFilePath);
        var tmp = require("tmp");
        var tmpFilePath = tmp.tmpNameSync({ postfix: ext });

        if (localFilePath != null) {
            args += ' "' + expansePath(localFilePath) + '"'
        }

        if (Number.isInteger(revision)) {
            args += ` -r ${revision}`;
        }

        // forward all output to the file
        args += ' > "' + tmpFilePath + '"';

        SvnService.execute("cat", (err, strdout, stderr) => {
            if (err) {
                reject(err);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(tmpFilePath);
            }
        }, args);
    });
}