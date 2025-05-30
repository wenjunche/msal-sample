// # Query/Mutation Errors
//
// In order for us to be able to show, and handle errors in a correct way, that delivers as much feedback to the user as possible,

/**
 * A type that represents a value that can be `null` or `undefined`.
 */
export type Maybe<TType> = TType | undefined | null;

/** */
export type TRequestError = PermissionDeniedRequestError | BadRequestError | UnknownRequestError | ObjectNotFoundError;

// ERR_PERMISSION_DENIED
type PermissionDeniedRequestError = {
    code: 'ERR_PERMISSION_DENIED';
};

// ERR_BAD_REQUEST
type BadRequestError = {
    code: 'ERR_BAD_REQUEST';
    data?: unknown;
};
// ERR_BAD_REQUEST
type ObjectNotFoundError = {
    code: 'ERR_OBJECT_NOT_FOUND';
    data?: unknown;
};

type UnknownRequestError = {
    code: string & {};
};

/**
 * Typical wrapper around the `TypeError` thrown when a network request fails.
 */
export class FailedNetworkRequestError extends Error {}

/**
 * If `fetch` throws an error that is not a `TypeError`, this error will be thrown.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/API/fetch#exceptions
 *
 * An "AbortError" should never be thrown as no requests are currently aborted.
 *
 * According too MDN, this should be never be thrown, (as fetch __should__ only throw a TypeError)
 *
 * But in the interest of satisfying the type checker, we will include it.
 */
export class UnknownFetchError extends Error {}

/**
 * We expect all responses from the Workspace Server to be JSON.
 *
 * If parsing one of the responses fails, this error will be thrown.
 */
export class InvalidResponseError extends Error {}

/**
 * If the response from the Workspace Server is not OK, this error will be thrown.
 *
 * It contains custom data from the response, that can be used to display more information to the user.
 *
 * For example, if it was a bad request/permission error/internal server error, etc.
 */
export class RequestError extends Error {
    #data: TRequestError;
    #status: number;

    constructor(message: string, status: number, data: TRequestError) {
        super(message);
        this.#status = status;
        this.#data = data;
    }

    get data(): TRequestError {
        return this.#data;
    }

    get status(): number {
        return this.#status;
    }
}

export class BulkRequestError {
    #errors: RequestError[];
    #successCount: number;
    #errorCount: number;

    constructor(errors: RequestError[], successCount: number, errorCount: number) {
        this.#errors = errors;
        this.#successCount = successCount;
        this.#errorCount = errorCount;
    }

    get errors(): RequestError[] {
        return this.#errors;
    }

    get successCount(): number {
        return this.#successCount;
    }

    get errorCount(): number {
        return this.#errorCount;
    }
}
