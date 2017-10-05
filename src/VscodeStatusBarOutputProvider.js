import { window, StatusBarAlignment } from 'vscode';

export class VscodeStatusBarOutputProvider {
    /**
     * Creates an instance of VscodeStatusBarOutputProvider.
     * @param {String} command 
     * @memberof VscodeStatusBarOutputProvider
     */
    constructor(scmName = 'svn', scmIcon = '$(git-branch)') {
        this.scmName = scmName;
        this.scmIcon = scmIcon;
        this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, Number.MAX_VALUE);
        this.lastState = null;

        this.hasChanges = false;
    }

    setState(state) {
        let icon = '',
            visible = false,
            command = null;

        switch (state) {
            case STATUS_IDLE:
                visible = true;
                command = 'svn.info';
                break;

            case STATUS_START_SYNC:
                visible = true;
                icon = '$(sync~spin)';
                break;

            case STATUS_STOP_SYNC:
                visible = true;
                icon = '';
                break;
        }

        if (visible) {
            this.statusBarItem.text = `${this.scmIcon} ${this.scmName}${this.hasChanges ? '*' : ''} ${icon}`;
            this.statusBarItem.command = command;
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }

        this.lastState = state;
    }

    refresh() {
        this.setState(this.lastState);
    }

    print(output) {
        this.statusBarItem.tooltip = output;
        window.setStatusBarMessage("SVN Error: " + output, 3000);
    }

    dispose() {
        this.statusBarItem.dispose();
    }
}

export const STATUS_IDLE = 0;
export const STATUS_START_SYNC = 1;
export const STATUS_STOP_SYNC = 2;