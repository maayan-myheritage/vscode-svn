import { Uri } from 'vscode';

export class ResourceGroup {
    get uri() { return Uri.parse(`svn-resource-group:${this.id}`); }
    get id() { return this._id; }
    get label() { return this._label; }
    get resourceStates() { return this._resources; }

    dispose() { }

    constructor(_id, _label, _resources) {
        this._id = _id;
        this._label = _label;
        this._resources = _resources;
    }
}

export class DefaultGroup extends ResourceGroup {
    constructor(resources) {
        super('default', 'Default Changelist', resources);
    }
}

export class PendingGroup extends ResourceGroup {
    constructor(chnum, resources) {
        super('pending' + ':' + chnum, 'Pending Changelist' + ' ' + chnum, resources);
    }
}

export class ShelvedGroup extends ResourceGroup {
    constructor(chnum, resources) {
        super('shelved' + ':' + chnum, 'Shelved Changelist' + ' ' + chnum, resources);
    }
}