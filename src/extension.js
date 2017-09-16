import { commands, window, workspace } from 'vscode';
import * as SvnCommands from './SvnCommands';
import * as Display from './Display';

let isRegistered = false;

function activate() {
    if (isRegistered) {
        return;
    }

    isRegistered = true;

    SvnCommands.registerCommands();
    Display.initialize();
}

exports.activate = activate;