import {
    workspace
} from 'vscode';

import * as Display from './Display';
import * as Utils from './Utils';
import * as CP from 'child_process';

let config = null;

export function setConfig(_config) {
    config = _config;
}

export function getConfig() {
    return config;
}

export function handleInfoServiceResponse(err, stdout, stderr) {
    if (err) {
        Display.showError(stderr.toString());
    } else {
        Display.channel.append(stdout.toString());
    }
}

export function handleCommonServiceResponse(err, stdout, stderr) {
    if (err) {
        Display.showError(stderr.toString());
    } else {
        Display.channel.append(stdout.toString());
        Display.updateEditor();
        // SvnSCMProvider.Refresh();
    }
}

export function execute(command, responseCallback, args, directoryOverride, input) {
    execCommand(command, responseCallback, args, directoryOverride, input);
}

export function executeAsPromise(command, args, directoryOverride, input) {
    return new Promise((resolve, reject) => {
        execCommand(command, (err, stdout, stderr) => {
            if (err) {
                reject(err.message);
            } else if (stderr) {
                reject(stderr);
            } else {
                resolve(stdout.toString());
            }
        }, args, directoryOverride, input);
    });
}

function execCommand(command, responseCallback, args, directoryOverride, input) {
    var cmdLine = getSvnCmdPath();
    const maxBuffer = workspace.getConfiguration('svn').get('maxBuffer', 200 * 1024);

    if (directoryOverride != null) {
        cmdLine += ' -d ' + directoryOverride;
    }
    cmdLine += ' ' + command;

    if (args != null) {
        if (config) {
            args = args.replace(config.localDir, '');
        }

        cmdLine += ' ' + args;
    }

    Display.channel.appendLine(cmdLine);
    var child = CP.exec(cmdLine, { cwd: config ? config.localDir : undefined, maxBuffer }, responseCallback);

    if (input != null) {
        child.stdin.end(input, 'utf8');
    }

}

export function getSvnCmdPath() {
    var svnPath = workspace.getConfiguration('svn').get('command', 'none');
    var svnUser = workspace.getConfiguration('svn').get('user', 'none');
    var svnClient = workspace.getConfiguration('svn').get('client', 'none');
    var svnPort = workspace.getConfiguration('svn').get('port', 'none');
    var svnPass = workspace.getConfiguration('svn').get('password', 'none');
    var svnDir = workspace.getConfiguration('svn').get('dir', 'none');

    const buildCmd = (value, arg) => {
        if (!value || value === 'none')
            return '';
        return ` ${arg} ${value}`;
    }

    if (svnPath == 'none') {
        var isWindows = /^win/.test(process.platform);
        svnPath = isWindows ? 'svn.exe' : 'svn';
    } else {
        const toUNC = (path) => {
            let uncPath = path;

            if (uncPath.indexOf('\\\\') !== 0) {
                const replaceable = uncPath.split('\\');
                uncPath = replaceable.join('\\\\');
            }

            uncPath = `"${uncPath}"`;
            return uncPath;
        }

        svnPath = toUNC(svnPath);
    }

    svnPath += buildCmd(svnUser, '-u');
    svnPath += buildCmd(svnClient, '-c');
    svnPath += buildCmd(svnPort, '-p');
    svnPath += buildCmd(svnPass, '-P');
    svnPath += buildCmd(svnDir, '-d');

    // later args override earlier args
    if (config) {
        svnPath += buildCmd(config.svnUser, '-u');
        svnPath += buildCmd(config.svnClient, '-c');
        svnPath += buildCmd(config.svnPort, '-p');
        svnPath += buildCmd(config.svnPass, '-P');
        svnPath += buildCmd(config.svnDir, '-d');
    }

    return svnPath;
}

export function convertToRel(path) {
    if (!config
        || !config.localDir || config.localDir.length === 0
        || !config.svnDir || config.svnDir.length === 0) {

        return path;
    }

    const pathN = Utils.normalize(path);
    if (pathN.startsWith(config.localDir)) {
        path = pathN.slice(config.localDir.length);
    }
    return path;
}