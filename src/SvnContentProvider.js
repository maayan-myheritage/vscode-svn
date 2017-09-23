import { workspace, Uri, EventEmitter } from 'vscode';
import * as Utils from './Utils';
import * as Display from './Display';

export class SvnContentProvider {

    constructor() {
        this.onDidChangeEmitter = new EventEmitter(),
            this.disposables = [];

        this.disposables.push(
            workspace.registerTextDocumentContentProvider('svn', this),
        );
    }

    get onDidChange() { return this.onDidChangeEmitter.event; }

    dispose() { this.disposables.forEach(d => d.dispose()); }

    provideTextDocumentContent(uri) {
        return Utils.isLoggedIn().then(value => {
            if (!value) {
                return '';
            }

            let command = uri.authority;
            let file = uri.fsPath ? Uri.file(uri.fsPath) : null;
            let revision = parseInt(uri.fragment);
            let args = decodeURIComponent(uri.query);

            return Utils.getOutput(command, file, revision, args);

        }).catch(reason => {
            Display.showError(reason.toString());
            return '';
        })
    }
}