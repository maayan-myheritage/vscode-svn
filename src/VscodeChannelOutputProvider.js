import { window } from 'vscode';

export class VscodeChannelOutputProvider {
    constructor() {
        this.channel = window.createOutputChannel('SVN');
    }

    print(message) {
        this.channel.appendLine(message);
    }

    dispose() {
        this.channel.dispose();
    }
}