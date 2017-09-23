import { scm, commands, window, workspace } from 'vscode';
import * as Path from 'path';

import { Model } from './scm/Model';
import { Status } from './scm/Status';
import { mapEvent } from './Utils';
import { FileType } from './scm/FileTypes';

let instance = null;

export class SvnScmProvider {

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    get onDidChange() {
        return mapEvent(this._model.onDidChange, () => this);
    }

    get resources() { return this._model.ResourceGroups; }
    get id() { return 'svn'; }
    get label() { return 'SVN'; }
    get count() {
        const countBadge = workspace.getConfiguration('svn').get('countBadge');
        const total = this._model.ResourceGroups.reduce((r, g) => r + g.resourceStates.length, 0);

        switch (countBadge) {
            case 'off':
                return 0;
            case 'all':
            default:
                return total;
        }
    }

    get sourceControl() {
        return this._model._sourceControl;
    }

    get stateContextKey() {
        if (workspace.rootPath == undefined) {
            return 'norepo';
        }

        return 'idle'
    }

    constructor() {

        this.disposables = [];
        this._model = null;
        this.Initialize();
    }

    Initialize() {
        this._model = new Model();

        instance = this;
        this._model._sourceControl = scm.createSourceControl(this.id, this.label);
        this._model._sourceControl.quickDiffProvider = this;
        this._model._sourceControl.acceptInputCommand = { command: 'svn.processChangelist', title: 'Process Changelist' };
        this._model._sourceControl.inputBox.value = '';

        // Hook up the model change event to trigger our own event
        this._model.onDidChange(this.onDidModelChange, this, this.disposables);
        this._model.Refresh();
    }

    onDidModelChange() {
        this._model._sourceControl.count = this.count;
        commands.executeCommand('setContext', 'svnState', this.stateContextKey);
    }

    static GetInstance() {
        const svnProvider = instance;
        if (!svnProvider) {
            console.log('svnProvider instance undefined');
        }
        return svnProvider;
    }

    static async OpenFile(resource) {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider.openFile(resource);
    };

    static async Open(resource) {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider.open(resource);
    };

    static async Sync() {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.Sync();
    };

    static async Refresh() {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.Refresh();
    };

    static async ProcessChangelist() {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.ProcessChangelist();
    };
    
    static async SubmitDefault() {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.SubmitDefault();
    };

    static async Submit(input) {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.Submit(input);
    };

    static async Revert(input) {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.Revert(input);
    };

    static async ShelveOrUnshelve(input) {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.ShelveOrUnshelve(input);
    };

    static async ReopenFile(input) {
        const svnProvider = SvnScmProvider.GetInstance();

        await svnProvider._model.ReopenFile(input);
    };

    provideOriginalResource(uri) {
        if (uri.scheme !== 'file') {
            return;
        }

        return uri.with({ scheme: 'svn', authority: 'cat' });
    }


    /**
     * This is the default action when an resource is clicked in the viewlet.
     * For ADD, AND UNDELETE just show the local file.
     * For DELETE just show the server file.
     * For EDIT AND RENAME show the diff window (server on left, local on right).
     */

    open(resource) {
        if (resource.FileType.base === FileType.BINARY) {
            const uri = resource.uri.with({ scheme: 'svn', authority: 'fstat' });
            workspace.openTextDocument(uri)
                .then(doc => window.showTextDocument(doc));
            return;
        }

        const left = this.getLeftResource(resource);
        const right = this.getRightResource(resource);
        const title = this.getTitle(resource);

        if (!left) {
            if (!right) {
                // TODO
                console.error("Status not supported: " + resource.status.toString());
                return;
            }
            commands.executeCommand("vscode.open", right);
            return;
        }
        commands.executeCommand("vscode.diff", left, right, title);
        return;
    }

    openFile(resource) {
        commands.executeCommand("vscode.open", resource.uri);
    }

    // Gets the uri for the previous version of the file.
    getLeftResource(resource) {
        switch (resource.status) {
            case Status.EDIT:
                return resource.uri.with({ scheme: 'svn', authority: 'cat' });
        }
    }

    // Gets the uri for the current version of the file (except for deleted files).
    getRightResource(resource) {
        switch (resource.status) {
            case Status.ADD:
            case Status.EDIT:
            case Status.MOVE_ADD:
                return resource.uri;
            case Status.MOVE_DELETE:
            case Status.DELETE:
                return resource.uri.with({ scheme: 'svn', authority: 'cat'});

        }
    }

    getTitle(resource) {
        const basename = Path.basename(resource.uri.fsPath);

        switch (resource.status) {
            case Status.EDIT:
                return `${basename} - Diff Against Most Recent Revision`;
        }

        return '';
    }

}
