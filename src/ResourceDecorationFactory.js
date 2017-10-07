import { Uri } from 'vscode';
import * as path from 'path';

const iconsRootPath = path.join(path.dirname(__dirname), 'resources', 'icons');

export class ResourceDecorationFactory {
    create(status) {

        const light = { iconPath: getIconPath(status, 'light') };
        const dark = { iconPath: getIconPath(status, 'dark') };

        const strikeThrough = useStrikeThrough(status);
        const faded = useFaded(status);

        return { light, dark, strikeThrough, faded }
    }
}

function getIconUri(iconName, theme) {
    return Uri.file(path.join(iconsRootPath, theme, `${iconName}.svg`));
}

function getIconPath(status, theme) {
    switch (status) {
        case '?': return getIconUri('status-unversioned', theme);
        case 'A': return getIconUri('status-added', theme);
        case 'D': return getIconUri('status-deleted', theme);
        case 'M': return getIconUri('status-modified', theme);
        case 'R': return getIconUri('status-renamed', theme);
        default: return void 0;
    }
}

function useStrikeThrough(status) {
    return (status === 'D') || (status === 'R');
}

function useFaded(status) {
    return (status === 'I');
}