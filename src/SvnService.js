import {
    workspace,
    window,
    TextDocument
} from 'vscode';

import * as Display from './Display';
import * as CP from 'child_process';

let _config = null;

export function setConfig(config) {
    _config = config;
}

export function getConfig() {
    return _config;
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

function execCommand(command, responseCallback, args, directoryOverride, input) {
    var cmdLine = getSvnCmdPath();
    const maxBuffer = workspace.getConfiguration('svn').get('maxBuffer', 200 * 1024);

    if (directoryOverride != null) {
        cmdLine += ' -d ' + directoryOverride;
    }
    cmdLine += ' ' + command;

    if (args != null) {
        if (_config) {
            args = args.replace(_config.localDir, '');
        }

        cmdLine += ' ' + args;
    }

    Display.channel.appendLine(cmdLine);
    var child = CP.exec(cmdLine, { cwd: _config ? _config.localDir : undefined, maxBuffer: maxBuffer }, responseCallback);

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
    if (_config) {
        svnPath += buildCmd(_config.p4User, '-u');
        svnPath += buildCmd(_config.p4Client, '-c');
        svnPath += buildCmd(_config.p4Port, '-p');
        svnPath += buildCmd(_config.p4Pass, '-P');
        svnPath += buildCmd(_config.p4Dir, '-d');
    }

    return svnPath;
}

export function convertToRel(path) {
    if (!_config
        || !_config.localDir || _config.localDir.length === 0
        || !_config.p4Dir || _config.p4Dir.length === 0) {

        return path;
    }

    const pathN = Utils.normalize(path);
    if (pathN.startsWith(_config.localDir)) {
        path = pathN.slice(_config.localDir.length);
    }
    return path;
}