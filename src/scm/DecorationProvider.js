import { Uri } from 'vscode';
import { Status } from './Status';
import * as path from 'path';

const _iconsRootPath = path.join(path.dirname(__dirname), '..', 'resources', 'icons');

export class DecorationProvider {


    static getDecorations(status) {
        const light = { iconPath: DecorationProvider.getIconPath(status, 'light') };
        const dark = { iconPath: DecorationProvider.getIconPath(status, 'dark') };

        const strikeThrough = DecorationProvider.useStrikeThrough(status);
        const faded = DecorationProvider.useFaded(status);

        return { strikeThrough, faded, light, dark };
    }

    static getIconUri(iconName, theme) {
        return Uri.file(path.join(_iconsRootPath, theme, `${iconName}.svg`));
    }

    static getIconPath(status, theme) {
        switch (status) {
            case '?': return DecorationProvider.getIconUri('create', theme);
            case 'A': return DecorationProvider.getIconUri('status-add', theme);
            case 'D': return DecorationProvider.getIconUri('status-delete', theme);
            case 'M': return DecorationProvider.getIconUri('status-move', theme);
            default: return void 0;
        }
    }

    static useStrikeThrough(status) {
        return (status === 'D') || (status === 'R');
    }

    static useFaded(status) {
        return (status === 'I');
    }
}
