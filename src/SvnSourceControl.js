import { scm, commands, workspace, window, Uri, EventEmitter } from 'vscode';
import * as path from 'path';
import { Resource } from './Resource';
import { SvnUtils } from './SvnUtils';

import { SvnScmCommands } from './SvnScmCommands';
import { ResourceDecorationFactory } from './ResourceDecorationFactory';
import {
    NoActiveTextEditorError,
    MissingCommitMessageError,
    NoResourceChangelistError,
    NoResourceUriError
} from './Errors';


export const SVN_ID = 'svn';
export const SVN_LABEL = 'svn';

export const CHANGELIST_DEFAULT = 'default';
export const CHANGELIST_NEW = 'new';
export const CHANGELIST_UNVERSIONED = 'unversioned';

let onInit,
    onRefresh,
    onError;

export class SvnSourceControl {

    /**
     * Creates an instance of SvnSourceControl.
     * @param {SvnScmCommands} svnScmCommands
     * @param {ResourceDecorartionFactory} resourceDecorartionFactory
     * @param {boolean} [enabled=true] 
     */
    constructor(svnScmCommands, resourceDecorartionFactory, enabled = true) {
        this.svnScmCommands = svnScmCommands;

        this.disposables = [];
        this.enabled = enabled;

        this.resourceDecorartionFactory = resourceDecorartionFactory;
        this.resourceGroups = [];
        this.defaultGroup = null;
        this.changedFiles = [];
        this.changelistsGroups = [];

        onInit = new EventEmitter();
        onRefresh = new EventEmitter();
        onError = new EventEmitter();
    }

    init() {
        this.sourceControl = scm.createSourceControl(SVN_ID, SVN_LABEL);
        this.sourceControl.quickDiffProvider = this;
        this.sourceControl.acceptInputCommand = { command: 'svn.commitActiveChangelist', title: 'Commit active changelist' };
        this.sourceControl.inputBox.value = '';

        this.registerCommands();
        this.refreshView()
            .then(() => onInit.fire());
    }

    provideOriginalResource(uri) {
        if (uri.scheme !== 'file') {
            return;
        }

        return uri.with({ scheme: 'svn' });
    }

    cleanResourceGroups() {
        this.resourceGroups.forEach((group) => {
            group.dispose();
        });
        this.resourceGroups = [];
        this.changelistsGroups = [];
    }

    refreshView() {
        return this.svnScmCommands.status()
            .then(output => {
                this.cleanResourceGroups();

                let changedFiles = SvnUtils.parseFilesOutput(output);
                if (changedFiles instanceof Array) {
                    let defaultGroup = this.sourceControl.createResourceGroup(CHANGELIST_DEFAULT, CHANGELIST_DEFAULT),
                        unversionedResources = [],
                        changelistGroups = {};

                    defaultGroup.resourceStates = [];
                    this.resourceGroups.push(defaultGroup);
                    this.defaultGroup = defaultGroup;

                    changedFiles.forEach((item) => {
                        let resource = new Resource(item.file, item.status, this.resourceDecorartionFactory.create(item.status));

                        switch (item.group) {
                            case 'default':
                                defaultGroup.resourceStates = [resource].concat(defaultGroup.resourceStates);
                                break;

                            case 'unversioned':
                                unversionedResources.push(resource);
                                break;

                            default:
                                let changelistGroup;
                                if (!changelistGroups.hasOwnProperty(item.group)) {
                                    changelistGroup = this.sourceControl.createResourceGroup(item.group, item.group);
                                    changelistGroup.resourceStates = [];
                                    this.resourceGroups.push(changelistGroup);
                                    changelistGroups[item.group] = changelistGroup;
                                    this.changelistsGroups.push(changelistGroup);
                                } else {
                                    changelistGroup = changelistGroups[item.group];
                                }

                                changelistGroup.resourceStates = [resource].concat(changelistGroups[item.group].resourceStates);
                                break;
                        }
                    });

                    if (unversionedResources.length > 0) {
                        let unversionedGroup = this.sourceControl.createResourceGroup(CHANGELIST_UNVERSIONED, CHANGELIST_UNVERSIONED);
                        unversionedGroup.resourceStates = [];
                        this.resourceGroups.push(unversionedGroup);
                        unversionedGroup.resourceStates = unversionedResources.concat(unversionedGroup.resourceStates);
                    }

                    this.changedFiles = changedFiles;
                }

                onRefresh.fire();
            })
    }

    get hasChanges() {
        return this.changedFiles.length > 0;
    }

    get onRefresh() {
        return onRefresh.event;
    }

    get onInit() {
        return onInit.event;
    }

    get onError() {
        return onError.event;
    }

    registerCommands() {
        commands.registerCommand('svn.updateWorkingCopy', this.handleUpdateWorkingCopyCommand.bind(this));
        commands.registerCommand('svn.update', createCommand(this, this.handleUpdateCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.refresh', this.handleRefreshCommand.bind(this));
        commands.registerCommand('svn.commitAll', this.handleCommitAllCommand.bind(this));
        commands.registerCommand('svn.commitPath', createCommand(this, this.handleCommitCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.commitChangelist', this.handleCommitChangelistCommand.bind(this));
        commands.registerCommand('svn.commitActiveChangelist', this.handleCommitActiveChangelistCommand.bind(this));
        commands.registerCommand('svn.add', createCommand(this, this.handleAddCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.openFile', this.handleOpenFileCommand.bind(this));
        commands.registerCommand('svn.openChanges', this.handleOpenChangesCommand.bind(this));
        commands.registerCommand('svn.revertWorkingCopy', this.handleRevertWorkingCopyCommand.bind(this));
        commands.registerCommand('svn.revert', createCommand(this, this.handleRevertCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.revertChangelist', this.handleRevertChangelistCommand.bind(this));
        commands.registerCommand('svn.deleteChangelist', this.handleDeleteChangelistCommand.bind(this));
        commands.registerCommand('svn.diff', createCommand(this, this.handleDiffCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.diffRevision', createCommand(this, this.handleDiffRevisionCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.moveToChangelist', createCommand(this, this.handleMoveToChangelistCommand, { useActiveTextEditor: true }));
        commands.registerCommand('svn.info', this.handleInfoCommand.bind(this));
    }

    handleUpdateWorkingCopyCommand() {
        this.svnScmCommands.updateWorkingCopy()
            .then(this.refreshView.bind(this));
    }

    handleUpdateCommand(uris) {
        this.svnScmCommands.updatePath(uris.map(uri => uri.fsPath))
            .then(this.refreshView.bind(this));
    }

    handleRefreshCommand() {
        this.refreshView();
    }

    handleCommitAllCommand() {
        let changelists = getChangelistsForQuickPick(this.changelistsGroups);

        if (changelists.length > 1) {
            window.showQuickPick(changelists, {
                placeHolder: 'Pick a changelist to commit',
                ignoreFocusOut: true
            }).then(changelist => {
                this.commitChangelist(changelist);
            })
        } else {
            this.commitChangelist(CHANGELIST_DEFAULT);
        }
    }

    handleCommitCommand(uris) {
        this.commitPath(uris.map(uri => uri.fsPath));
    }

    handleCommitChangelistCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.commitChangelist(resource.id);
    }

    handleCommitActiveChangelistCommand() {
        const message = scm.inputBox.value;
        scm.inputBox.value = '';

        let activeChangelist = CHANGELIST_DEFAULT; // TODO: Get active changelist from config

        if (activeChangelist == CHANGELIST_DEFAULT) {
            let paths = this.getDefaultChangelistPaths();
            this.svnScmCommands.commit(paths, message)
                .then(this.refreshView.bind(this));
        } else {
            this.svnScmCommands.commitChangelist(activeChangelist, message)
                .then(this.refreshView.bind(this));
        }
    }

    commitPath(path) {
        getCommitMessage().then(message => {
            if (!validateCommitMessage(message)) {
                onError.fire(new MissingCommitMessageError());
            } else if (message) {
                this.svnScmCommands.commit(path, message)
                    .then(this.refreshView.bind(this));
            }
        })
    }

    commitChangelist(changelist) {
        if (changelist == CHANGELIST_DEFAULT) {
            this.commitDefaultChangelist();
        } else {
            getCommitMessage().then(message => {
                if (!validateCommitMessage(message)) {
                    onError.fire(new MissingCommitMessageError());
                } else if (message) {
                    this.svnScmCommands.commitChangelist(changelist, message)
                        .then(this.refreshView.bind(this));
                }
            });
        }
    }

    commitDefaultChangelist() {
        let paths = this.getDefaultChangelistPaths();

        if (paths.length > 0) {
            getCommitMessage().then(message => {
                if (!validateCommitMessage(message)) {
                    onError.fire(new MissingCommitMessageError());
                } else if (message) {
                    this.svnScmCommands.commit(paths, message)
                        .then(this.refreshView.bind(this));
                }
            })
        }
    }

    getDefaultChangelistPaths() {
        let paths = this.defaultGroup.resourceStates.map(resource => {
            return resource.uri.fsPath;
        })

        return paths;
    }

    handleAddCommand(uris) {
        this.svnScmCommands.addPath(uris.map(uri => uri.fsPath))
            .then(this.refreshView.bind(this))
    }

    handleRevertWorkingCopyCommand() {
        window.showInformationMessage(`Are you sure you want to discard all changes?`, {
            modal: true
        }, 'Discard Changes')
            .then(value => {
                if (value == 'Discard Changes') {
                    this.svnScmCommands.revertWorkingCopy()
                        .then(this.refreshView.bind(this))
                }
            })
    }

    handleRevertCommand(uris) {
        let message = uris.length > 1
            ? message = `Are you sure you want to discard ${uris.length} changes?`
            : message = `Are you sure you want to discard changes in ${path.basename(uris[0].fsPath)}?`;

        window.showInformationMessage(message, {
            modal: true
        }, 'Discard Changes').then(value => {
            if (value == 'Discard Changes') {
                this.svnScmCommands.revertPath(uris.map(uri => uri.fsPath))
                    .then(this.refreshView.bind(this))
            }
        })
    }

    handleRevertChangelistCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.svnScmCommands.revertChangelist(resource.id)
            .then(this.refreshView.bind(this))
    }

    handleDeleteChangelistCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.svnScmCommands.deleteChangelist(resource.id)
            .then(this.refreshView.bind(this))
    }

    handleOpenFileCommand(resource) {
        commands.executeCommand("vscode.open", resource.uri)
    }

    handleOpenChangesCommand(resource) {
        if (!resource) {
            return;
        }

        switch (resource.status) {
            case 'M':
                this.diff(resource.resourceUri.fsPath, 'HEAD');
                break;

            case 'D':
                // TODO: Open from repository
                break;

            default:
                this.handleOpenFileCommand(resource);
        }
    }

    handleDiffCommand(uris) {
        uris.map(uri => {
            this.diff(uri.fsPath);
        })
    }

    handleDiffRevisionCommand(uris) {
        if (uris.length == 1) {
            this.diffPickRevision(uris[0].fsPath);
        }
    }

    diff(filePath, revision = 'HEAD') {
        this.svnScmCommands.getFileOutput(filePath, revision)
            .then((tmpFileUri) => {
                let filename = path.basename(filePath);
                commands.executeCommand('vscode.diff', tmpFileUri, Uri.file(filePath), `Compare ${filename} with revision ${revision}`);
            })
    }

    diffPickRevision(path) {
        this.svnScmCommands.getPathRevisions(path)
            .then(revisionsData => {
                window.showQuickPick(revisionsData).then(revision => {
                    this.diff(path, parseInt(revision.revisionNumber));
                })
            });
    }

    handleMoveToChangelistCommand(uris) {
        this.moveToChangelist(uris.map(uri => uri.fsPath));
    }

    moveToChangelist(path) {
        let changelists = getChangelistsForQuickPick(this.changelistsGroups, true, true);

        window.showQuickPick(changelists).then(changelist => {
            if (changelist === CHANGELIST_NEW) {
                window.showInputBox({
                    placeHolder: 'New changelist name',
                    ignoreFocusOut: true
                }).then(newChangelist => {
                    if (newChangelist.trim() != '') {
                        this.svnScmCommands.moveToChangelist(path, newChangelist)
                            .then(this.refreshView.bind(this))
                    }
                });
            } else {
                this.svnScmCommands.moveToChangelist(path, changelist == CHANGELIST_DEFAULT ? '--remove' : `"${changelist}"`)
                    .then(this.refreshView.bind(this))
            }
        })
    }

    handleInfoCommand() {
        this.svnScmCommands.info()
            .then(output => {
                window.showInformationMessage(output, { modal: true });
            })
            .catch(error => {
                onError.fire(error)
            });
    }

    dispose() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * @param {Array} groups 
 * @returns {Array}
 */
function getChangelistsForQuickPick(groups, includeDefault = true, includeNew = false) {
    let changelists = [];
    if (groups.length > 0) {
        changelists = groups.map((changelist) => {
            return changelist.label;
        });
    }

    if (includeDefault) {
        changelists.unshift(CHANGELIST_DEFAULT);
    }

    if (includeNew) {
        changelists.push(CHANGELIST_NEW);
    }

    return changelists;
}

function getCommitMessage() {
    return window.showInputBox({
        placeHolder: 'Commit message',
        ignoreFocusOut: true
    });
}

function validateCommitMessage(message) {
    if (message && !message.trim()) {
        return false;
    }

    return true;
}

function createCommand(target, method, options) {
    return (...resourceStates) => {
        let uris = resourceStates
            .filter(resource => resource instanceof Resource)
            .map(resource => resource.resourceUri);

        if (uris.length == 0) {
            uris = resourceStates
                .filter(resource => resource instanceof Uri)

            if (uris.length == 0 && options.useActiveTextEditor) {
                uris = [window.activeTextEditor && window.activeTextEditor.document.uri];
            }
        }

        if (uris.length == 0) {
            onError.fire(new NoResourceUriError());
            return;
        }

        method.call(target, uris);
    };
}