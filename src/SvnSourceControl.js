import { scm, commands, workspace, window, Uri, EventEmitter } from 'vscode';
import * as path from 'path';
import { Resource } from './Resource';
import { SvnUtils } from './SvnUtils';

import { SvnCommandLineService } from './SvnCommandLineService';
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
     * @param {SvnCommandLineService} svnCmd
     * @param {SvnScmCommands} svnScmCommands
     * @param {ResourceDecorartionFactory} resourceDecorartionFactory
     * @param {boolean} [enabled=true] 
     */
    constructor(svnCmd, svnScmCommands, resourceDecorartionFactory, enabled = true) {
        this.svnCmd = svnCmd;
        this.svnScmCommands = svnScmCommands;

        this.disposables = [];
        this.enabled = enabled;

        this.resourceDecorartionFactory = resourceDecorartionFactory;
        this.resourceGroups = [];
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
        return this.svnCmd.execute('status')
            .then(output => {
                this.cleanResourceGroups();

                let changedFiles = SvnUtils.parseFilesOutput(output);
                if (changedFiles instanceof Array) {
                    let defaultGroup = this.sourceControl.createResourceGroup(CHANGELIST_DEFAULT, CHANGELIST_DEFAULT),
                        unversionedResources = [],
                        changelistGroups = {};

                    defaultGroup.resourceStates = [];
                    this.resourceGroups.push(defaultGroup);

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
        commands.registerCommand('svn.updateEditorFile', this.handleUpdateEditorFileCommand.bind(this));
        commands.registerCommand('svn.refresh', this.handleRefreshCommand.bind(this));
        commands.registerCommand('svn.commit', this.handleCommitCommand.bind(this));
        commands.registerCommand('svn.commitEditorFile', this.handleCommitEditorFileCommand.bind(this));
        commands.registerCommand('svn.commitPath', this.handleCommitPathCommand.bind(this));
        commands.registerCommand('svn.commitChangelist', this.handleCommitChangelistCommand.bind(this));
        commands.registerCommand('svn.commitActiveChangelist', this.handleCommitActiveChangelistCommand.bind(this));
        commands.registerCommand('svn.addEditorFile', this.handleAddEditorFileCommand.bind(this));
        commands.registerCommand('svn.addPath', this.handleAddPathCommand.bind(this));
        commands.registerCommand('svn.openFile', this.handleOpenFileCommand.bind(this));
        commands.registerCommand('svn.openChanges', this.handleOpenChangesCommand.bind(this));
        commands.registerCommand('svn.revertWorkingCopy', this.handleRevertWorkingCopyCommand.bind(this));
        commands.registerCommand('svn.revertPath', this.handleRevertPathCommand.bind(this));
        commands.registerCommand('svn.revertEditorFile', this.handleRevertEditorFileCommand.bind(this));
        commands.registerCommand('svn.revertChangelist', this.handleRevertChangelistCommand.bind(this));
        commands.registerCommand('svn.deleteChangelist', this.handleDeleteChangelistCommand.bind(this));
        commands.registerCommand('svn.diffEditorFile', this.handleDiffEditorFileCommand.bind(this));
        commands.registerCommand('svn.diffPath', this.handleDiffPathCommand.bind(this));
        commands.registerCommand('svn.diffEditorFileRevision', this.handleDiffEditorFileRevisionCommand.bind(this));
        commands.registerCommand('svn.diffPathRevision', this.handleDiffPathRevisionCommand.bind(this));
        commands.registerCommand('svn.moveEditorFileToChangelist', this.handleMoveEditorFileToChangelistCommand.bind(this));
        commands.registerCommand('svn.movePathToChangelist', this.handleMovePathToChangelistCommand.bind(this));
        commands.registerCommand('svn.info', this.handleInfoCommand.bind(this));
    }

    handleUpdateWorkingCopyCommand() {
        this.svnScmCommands.updateWorkingCopy()
            .then(this.refreshView.bind(this));
    }

    handleUpdateEditorFileCommand() {
        if (window.activeTextEditor) {
            this.svnScmCommands.updatePath(window.activeTextEditor.document.uri.fsPath)
                .then(this.refreshView.bind(this));
        } else {
            onError.fire(new NoActiveTextEditorError());
        }
    }

    handleRefreshCommand() {
        this.refreshView();
    }

    handleCommitCommand() {
        let changelists = getChangelistsForQuickPick(this.changelistsGroups);

        if (changelists.length > 1) {
            window.showQuickPick(changelists, {
                placeHolder: 'Pick a changelist to commit',
                ignoreFocusOut: true
            }).then(changelist => {
                this.svnScmCommands.commitChangelist(changelist);

            })
        } else {
            this.svnScmCommands.commitChangelist(CHANGELIST_DEFAULT);
        }
    }

    handleCommitEditorFileCommand() {
        if (window.activeTextEditor) {
            this.commitPath(window.activeTextEditor.document.uri.fsPath)
                .then(this.refreshView.bind(this));
        } else {
            onError.fire(new NoActiveTextEditorError());
        }
    }

    handleCommitPathCommand(resource) {
        if (!resource || !resource.resourceUri) {
            onError.fire(new NoResourceUriError(resource));
            return;
        }

        this.commitPath(resource.resourceUri.fsPath);
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
        this.svnScmCommands.commit('.', message, CHANGELIST_DEFAULT) // TODO: Get active changelist from config
            .then(this.refreshView.bind(this));
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
        getCommitMessage().then(message => {
            if (!validateCommitMessage(message)) {
                onError.fire(new MissingCommitMessageError());
            } else if (message) {
                this.svnScmCommands.commitChangelist(changelist, message)
                    .then(this.refreshView.bind(this));
            }
        });
    }

    handleAddEditorFileCommand() {
        if (window.activeTextEditor) {
            this.svnScmCommands.addPath(window.activeTextEditor.document.uri.fsPath)
                .then(this.refreshView.bind(this))
        } else {
            onError.fire(new NoActiveTextEditorError());
        }
    }

    handleAddPathCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.svnScmCommands.addPath(resource.resourceUri.fsPath)
            .then(this.refreshView.bind(this))
    }

    handleRevertWorkingCopyCommand() {
        this.svnCmd.execute('revert', `. --depth infinity`)
            .then(this.refreshView.bind(this))
    }

    handleRevertEditorFileCommand() {
        if (!window.activeTextEditor) {
            onError.fire(new NoActiveTextEditorError());
            return;
        }

        this.svnScmCommands.revertPath(window.activeTextEditor.document.uri.fsPath)
            .then(this.refreshView.bind(this))
    }

    handleRevertPathCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.svnScmCommands.revertPath(resource.resourceUri.fsPath)
            .then(this.refreshView.bind(this))
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
                this.handleDiffPathCommand(resource, 'HEAD');
                break;

            case 'D':
                // TODO: Open from repository
                break;

            default:
                this.handleOpenFileCommand(resource);
        }
    }

    handleDiffEditorFileCommand() {
        if (!window.activeTextEditor) {
            onError.fire(new NoActiveTextEditorError());
            return;
        }

        this.diff(window.activeTextEditor.document.uri.fsPath);
    }

    handleDiffPathCommand(resource, revision) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.diff(resource.resourceUri.fsPath, revision);
    }

    handleDiffPathRevisionCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.diffPickRevision(resource.resourceUri.fsPath);
    }

    handleDiffEditorFileRevisionCommand() {
        if (!window.activeTextEditor) {
            onError.fire(new NoActiveTextEditorError());
            return;
        }

        this.diffPickRevision(window.activeTextEditor.document.uri.fsPath);
    }

    diff(filePath, revision) {
        this.svnScmCommands.getFileOutput(filePath, revision)
            .then((tmpFileUri) => {
                let filename = path.basename(filePath);
                commands.executeCommand('vscode.diff', tmpFileUri, Uri.file(filePath), `Compare ${filename} current with revision ${revision}`);
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

    handleMoveEditorFileToChangelistCommand() {
        if (!window.activeTextEditor) {
            onError.fire(new NoActiveTextEditorError());
            return;
        }

        this.moveToChangelist(window.activeTextEditor.document.uri.fsPath);
    }

    handleMovePathToChangelistCommand(resource) {
        if (!resource || !resource.id) {
            onError.fire(new NoResourceChangelistError(resource));
            return;
        }

        this.moveToChangelist(resource.resourceUri.fsPath);
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
                        this.svnCmd.execute('changelist', `"${newChangelist}" "${path}"`)
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