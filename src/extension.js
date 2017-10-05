import { workspace, window } from 'vscode';
import * as cp from 'child_process';

import { SvnSourceControl } from './SvnSourceControl'
import { SvnCommandLineService } from './SvnCommandLineService';
import { ResourceDecorationFactory } from './ResourceDecorationFactory';
import { SvnTextContentProvider } from './SvnTextContentProvider';
import { SvnScmCommands } from './SvnScmCommands';
import { SvnFileSystemListener } from './SvnFileSystemListener';
import { VscodeChannelOutputProvider } from './VscodeChannelOutputProvider';
import {
    VscodeStatusBarOutputProvider,
    STATUS_IDLE,
    STATUS_START_SYNC,
    STATUS_STOP_SYNC,
} from './VscodeStatusBarOutputProvider';

let isRegistered = false;

function activate(context) {
    if (isRegistered) {
        return;
    }

    isRegistered = true;

    let svnCmd = new SvnCommandLineService({
        svnCommandPath: 'svn',
        dir: workspace.rootPath
    }, cp);
    let svnScmCommands = new SvnScmCommands(svnCmd);
    let svnSourceControl = new SvnSourceControl(svnCmd, svnScmCommands, new ResourceDecorationFactory());
    let svnTextContentProvider = new SvnTextContentProvider(svnCmd);
    let svnFileSystemListener = new SvnFileSystemListener(svnSourceControl);

    let outputLevelVerbose = workspace.getConfiguration('svn').get('outputLevelVerbose');

    let vscodeChannelOutputProvider = new VscodeChannelOutputProvider(),
        vscodeStatusBarOutputProvider = new VscodeStatusBarOutputProvider();

    svnScmCommands.getRepositoryName().then(name => {
        vscodeStatusBarOutputProvider.scmName = name;
        vscodeStatusBarOutputProvider.refresh();
    })

    vscodeStatusBarOutputProvider.setState(STATUS_IDLE);

    svnSourceControl.onInit(() => {
        vscodeStatusBarOutputProvider.hasChanges = svnSourceControl.hasChanges;
        vscodeStatusBarOutputProvider.setState(STATUS_IDLE);
    })

    svnSourceControl.onRefresh(() => {
        vscodeStatusBarOutputProvider.hasChanges = svnSourceControl.hasChanges;
        vscodeStatusBarOutputProvider.setState(STATUS_IDLE);
    })

    svnSourceControl.onError((error) => {
        window.showErrorMessage(error.message);
    })

    // Register commands events
    svnCmd.onExecute(command => {
        vscodeChannelOutputProvider.print(command);
        vscodeStatusBarOutputProvider.setState(STATUS_START_SYNC);
    });

    svnCmd.onSuccess(output => {
        if (outputLevelVerbose) {
            vscodeChannelOutputProvider.print(output);
        }
        vscodeStatusBarOutputProvider.setState(STATUS_STOP_SYNC);
    });

    svnCmd.onError(message => {
        vscodeChannelOutputProvider.print(message);
        vscodeStatusBarOutputProvider.print(message);
        vscodeStatusBarOutputProvider.setState(STATUS_STOP_SYNC);
    })

    context.subscriptions.push(svnSourceControl);
    context.subscriptions.push(svnTextContentProvider);
    context.subscriptions.push(svnFileSystemListener);

    svnSourceControl.init();
    svnTextContentProvider.init();
}

exports.activate = activate;