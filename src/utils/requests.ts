import { FailedNetworkRequestError, InvalidResponseError, type Maybe, RequestError, type TRequestError, UnknownFetchError } from './errors';

const OPENFIN_CLOUD_API_URL ='http://localhost';

type HandleAPIRequestInit = Omit<RequestInit, 'credentials' | 'mode' | 'method' | 'body'> &
    (
        | {
              method: 'PUT' | 'PATCH' | 'POST';
              bodyType?: 'json' | 'form-data';
              body?: RequestInit['body'];
          }
        | {
              method: 'GET' | 'DELETE';
          }
    );

/**
 * Handles making an API request to the OpenFin Cloud API.
 *
 * @param path - The path to the API endpoint. MUST start with a `/`. (during dev, the `OPENFIN_CLOUD_API_URL` is set, but in prod it is not (empty string). So, the path MUST start with a `/` in order to be a valid URL)
 * @param init - The `RequestInit` object to pass to `fetch`.
 * @returns The parsed JSON response from the API.
 *
 * @throws {FailedNetworkRequestError} - If the request fails due to a network error.
 * @throws {UnknownFetchError} - If the request fails due to an unknown error.
 *
 * @throws {InvalidResponseError} - If the response is not a valid JSON response, and we expected it to be json.
 */
export async function handleAPIRequest<T>(path: `/${string}`, init: HandleAPIRequestInit): Promise<T> {
    const request = await makeAPIRequest(path, init);
    return handleAPIResponse(request);
}

/**
 * Wrapper around `fetch` for making API requests to the OpenFin Cloud API.
 *
 * @param path - The path to the API endpoint. MUST start with a `/`. (during dev, the `OPENFIN_CLOUD_API_URL` is set, but in prod it is not (empty string). So, the path MUST start with a `/` in order to be a valid URL)
 * @param init - The `RequestInit` object to pass to `fetch`.
 * @returns The `Response` object from `fetch`.
 *
 * @throws {FailedNetworkRequestError} - If the request fails due to a network error.
 * @throws {UnknownFetchError} - If the request fails due to an unknown error.
 */
async function makeAPIRequest(
    path: `/${string}`,
    { bodyType = 'json', ...init }: Omit<RequestInit & { bodyType?: 'json' | 'form-data' }, 'credentials' | 'mode'>,
): Promise<Response> {
    try {
        return await fetch(`${OPENFIN_CLOUD_API_URL}${path}`, {
            credentials: 'include',
            mode: 'cors',
            ...init,
            headers: {
                ...(init.method === 'GET' || init.method === 'DELETE' ? {} : bodyType === 'json' ? { 'Content-Type': 'application/json' } : {}),
                ...init.headers,
            },
        });
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            throw new FailedNetworkRequestError(error.message, { ...error });
        }
        if (error instanceof Error) {
            throw new UnknownFetchError(error.message, { ...error });
        }

        throw new UnknownFetchError('Unknown fetch error', { cause: error });
    }
}

/**
 * Handles the response from an API request.
 *
 * @param response - The `Response` object from `fetch`.
 * @returns The parsed JSON response from the API.
 *
 * @throws {RequestError} - If the response is not ok.
 * @throws {InvalidResponseError} - If the response is not a valid JSON response, and we expected it to be json.
 */
async function handleAPIResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const responseJson = await getResponseJsonIfValid(response);
        throw new RequestError('Something went wrong', response.status, responseJson as never as TRequestError);
    }

    return getResponseJson(response);
}

/**
 * Parses the JSON from the response body.
 *
 * @param response - The `Response` object from `fetch`.
 * @returns The parsed JSON from the response body.
 *
 * @throws {InvalidResponseError} - If the response is not a valid JSON response, and we expected it to be json.
 */
async function getResponseJson<T>(response: Response): Promise<T> {
    try {
        const contentType = response.headers.get('content-type');

        if (!contentType) {
            throw new InvalidResponseError('Invalid response: No content-type header');
        }

        if (!contentType.includes('application/json')) {
            throw new InvalidResponseError('Invalid response: Content-type is not application/json');
        }

        return await response.json();
    } catch (error) {
        const maybeError = error as never as Maybe<Error>;

        throw new InvalidResponseError(maybeError?.message || 'Invalid response: Failed to parse JSON from response body', { ...maybeError });
    }
}

/**
 * Parses the JSON from the response body, if it is valid, else returns `null`.
 *
 * @param response - The `Response` object from `fetch`.
 * @returns The parsed JSON from the response body, or `null` if the response body is not valid JSON.
 */
async function getResponseJsonIfValid<T>(response: Response): Promise<T | null> {
    try {
        return await response.json();
    } catch (error) {
        console.warn('Failed to parse JSON from response body', error);
    }

    return null;
}
