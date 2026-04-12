import { auth } from '@/config/firebase';

/**
 * Drop-in replacement for `fetch` that attaches the current Firebase user's
 * ID token as an `Authorization: Bearer <token>` header. If no user is
 * signed in, the request is sent without the header (the server will
 * respond with 401).
 *
 * Callers set their own Content-Type/body — this wrapper only touches
 * the Authorization header and leaves everything else to the caller.
 */
export async function authFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const headers = new Headers(init?.headers);

    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken();
        headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(input, { ...init, headers });
}
