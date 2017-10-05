import { EventEmitter } from 'vscode';
import { SvnCommandError } from './Errors';

export const DEFAULT_MAX_BUFFER = 200 * 1024;

let onExecute,
    onSuccess,
    onError;

export class SvnCommandLineService {

    constructor(options = {}, cp) {
        this.options = options;
        this.cp = cp;

        onExecute = new EventEmitter();
        onSuccess = new EventEmitter();
        onError = new EventEmitter();
    }

    execute(command, args = '') {
        onExecute.fire(`svn ${command} ${args}`);

        return new Promise((resolve, reject) => {
            executeSync.call(this, command, args, (error, stdout, stderr) => {
                if (error || stderr) {
                    let errorMessage = error ? error.message : stderr;
                    onError.fire(errorMessage);
                    reject(new SvnCommandError(errorMessage));
                } else {
                    onSuccess.fire(stdout);
                    resolve(stdout);
                }
            })
        });
    }

    get onExecute() {
        return onExecute.event;
    }

    get onSuccess() {
        return onSuccess.event;
    }

    get onError() {
        return onError.event;
    }
}

function executeSync(command, args, callback, input) {
    const svnCommandPath = this.options.svnCommandPath ? this.options.svnCommandPath : '',
        maxBuffer = this.options.maxBuffer ? this.options.maxBuffer : DEFAULT_MAX_BUFFER,
        dir = this.options.dir ? this.options.dir : undefined;

    // Display.channel.appendLine(cmdLine);
    var child = this.cp.exec([svnCommandPath, command, args].join(' '), { cwd: dir ? dir : undefined, maxBuffer }, callback);

    if (input != null) {
        child.stdin.end(input, 'utf8');
    }
}