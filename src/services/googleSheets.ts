import { Contact } from '@/types/contact';
import type { BatchMap } from '@/services/export';
import { contactsToCrmValueMatrix } from '@/services/crmExport';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
/** Spreadsheets scope is enough to create a user-owned Sheet and write values. */
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_KEY = 'gsheets_token';
const USER_KEY = 'gsheets_user';

export interface SheetsExportResult {
    spreadsheetId: string;
    spreadsheetUrl: string;
    title: string;
    rowCount: number;
}

class GoogleSheetsService {
    private gisLoaded = false;
    private tokenClient: any = null;
    private accessToken: string | null = null;
    private user: { email: string; name: string } | null = null;

    constructor() {
        const savedToken = sessionStorage.getItem(TOKEN_KEY);
        const savedUser = sessionStorage.getItem(USER_KEY);
        if (savedToken) {
            this.accessToken = savedToken;
            this.user = savedUser ? JSON.parse(savedUser) : null;
        }
    }

    private persistSession(): void {
        if (this.accessToken) {
            sessionStorage.setItem(TOKEN_KEY, this.accessToken);
            if (this.user) {
                sessionStorage.setItem(USER_KEY, JSON.stringify(this.user));
            }
        }
    }

    private clearSession(): void {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
    }

    async init(): Promise<void> {
        if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
            await new Promise<void>((resolve, reject) => {
                const gisScript = document.createElement('script');
                gisScript.src = 'https://accounts.google.com/gsi/client';
                gisScript.onload = () => {
                    this.gisLoaded = true;
                    this.initializeGisClient();
                    resolve();
                };
                gisScript.onerror = () => reject(new Error('Failed to load Google Identity Services'));
                document.head.appendChild(gisScript);
            });
            return;
        }

        this.gisLoaded = true;
        this.initializeGisClient();
    }

    private initializeGisClient(): void {
        if (!GOOGLE_CLIENT_ID) {
            console.warn('Google Client ID not configured');
            return;
        }
        if (!(window as any).google?.accounts?.oauth2) {
            return;
        }

        this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: () => {},
        });
    }

    private async loadUserInfo(): Promise<void> {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (!response.ok) return;
            const data = await response.json();
            this.user = { email: data.email, name: data.name };
        } catch (error) {
            console.error('Failed to load Sheets user info:', error);
        }
    }

    isSignedIn(): boolean {
        return !!this.accessToken;
    }

    getUser(): { email: string; name: string } | null {
        return this.user ? { ...this.user } : null;
    }

    async signIn(): Promise<void> {
        if (!GOOGLE_CLIENT_ID) {
            throw new Error('Google Sheets export is not configured. Set VITE_GOOGLE_CLIENT_ID.');
        }
        if (!this.tokenClient) {
            await this.init();
        }
        if (!this.tokenClient) {
            throw new Error('Google Identity Services failed to initialize');
        }

        return new Promise((resolve, reject) => {
            this.tokenClient.callback = async (response: any) => {
                if (response.error) {
                    reject(new Error(response.error));
                    return;
                }
                this.accessToken = response.access_token;
                await this.loadUserInfo();
                this.persistSession();
                resolve();
            };
            this.tokenClient.requestAccessToken({
                prompt: this.accessToken ? '' : 'consent',
            });
        });
    }

    signOut(): void {
        this.accessToken = null;
        this.user = null;
        this.clearSession();
    }

    private async refreshToken(): Promise<boolean> {
        if (!this.tokenClient) {
            try {
                await this.init();
            } catch {
                return false;
            }
        }
        if (!this.tokenClient) return false;

        return new Promise((resolve) => {
            this.tokenClient.callback = async (response: any) => {
                if (response.error) {
                    resolve(false);
                    return;
                }
                this.accessToken = response.access_token;
                await this.loadUserInfo();
                this.persistSession();
                resolve(true);
            };
            this.tokenClient.requestAccessToken({ prompt: '' });
        });
    }

    private async fetchWithAuth(url: string, options: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
        const makeOpts = (): RequestInit => ({
            ...options,
            headers: {
                ...(options.headers || {}),
                Authorization: `Bearer ${this.accessToken}`,
            },
        });

        const response = await fetch(url, makeOpts());
        if (response.status === 401) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                return fetch(url, makeOpts());
            }
            this.signOut();
            throw new Error('Google Sheets session expired. Please export again to reconnect.');
        }
        return response;
    }

    /**
     * One-click: ensure OAuth, create a CRM-layout spreadsheet, write contacts, return the open URL.
     */
    async exportContacts(
        contacts: Contact[],
        batchMap?: BatchMap,
        titlePrefix = 'Cura.Tor Contacts'
    ): Promise<SheetsExportResult> {
        if (!this.accessToken) {
            await this.signIn();
        }
        if (!this.accessToken) {
            throw new Error('Not signed in to Google Sheets');
        }
        if (contacts.length === 0) {
            throw new Error('No contacts to export');
        }

        const title = `${titlePrefix} ${new Date().toISOString().slice(0, 10)}`;
        const values = contactsToCrmValueMatrix(contacts, batchMap);

        const createRes = await this.fetchWithAuth('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                properties: { title },
                sheets: [
                    {
                        properties: {
                            title: 'Contacts',
                            gridProperties: {
                                frozenRowCount: 1,
                            },
                        },
                    },
                ],
            }),
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Failed to create spreadsheet: ${errText || createRes.statusText}`);
        }

        const spreadsheet = await createRes.json();
        const spreadsheetId: string = spreadsheet.spreadsheetId;
        const spreadsheetUrl: string =
            spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

        const range = `Contacts!A1:${columnLetter(values[0].length)}${values.length}`;
        const updateRes = await this.fetchWithAuth(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ values }),
            }
        );

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            throw new Error(`Spreadsheet created but write failed: ${errText || updateRes.statusText}`);
        }

        // Best-effort: bold header row + auto-resize first columns
        try {
            const sheetId = spreadsheet.sheets?.[0]?.properties?.sheetId ?? 0;
            await this.fetchWithAuth(
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [
                            {
                                repeatCell: {
                                    range: {
                                        sheetId,
                                        startRowIndex: 0,
                                        endRowIndex: 1,
                                    },
                                    cell: {
                                        userEnteredFormat: {
                                            textFormat: { bold: true },
                                        },
                                    },
                                    fields: 'userEnteredFormat.textFormat.bold',
                                },
                            },
                            {
                                autoResizeDimensions: {
                                    dimensions: {
                                        sheetId,
                                        dimension: 'COLUMNS',
                                        startIndex: 0,
                                        endIndex: values[0].length,
                                    },
                                },
                            },
                        ],
                    }),
                }
            );
        } catch {
            // Non-fatal styling failure
        }

        return {
            spreadsheetId,
            spreadsheetUrl,
            title,
            rowCount: contacts.length,
        };
    }
}

function columnLetter(count: number): string {
    let n = count;
    let result = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        result = String.fromCharCode(65 + rem) + result;
        n = Math.floor((n - 1) / 26);
    }
    return result || 'A';
}

export const googleSheets = new GoogleSheetsService();
