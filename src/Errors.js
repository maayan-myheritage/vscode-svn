export class NoActiveTextEditorError extends Error {
    constructor() {
        super('No active text editor found.');
    }
}

export class NoResourceUriError extends Error {
    constructor(resource) {
        super(`Failed to get resource URI from ${resource}.`);
    }
}

export class NoResourceChangelistError extends Error {
    constructor(resource) {
        super(`Failed to get resource changelist from ${resource}.`);
    }
}

export class MissingCommitMessageError extends Error {
    constructor() {
        super('Commit message is missing.');
    }
}

export class SvnCommandError extends Error {
}