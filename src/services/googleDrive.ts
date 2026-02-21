import { Contact } from '@/types/contact';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '989864367677-fcll4q385kai03cj1hkhaa852i5rdhis.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const FILE_NAME = 'cura-tor-contacts.json';

interface GoogleDriveState {
  isSignedIn: boolean;
  user: { email: string; name: string } | null;
  fileId: string | null;
}

class GoogleDriveService {
  private gapiLoaded = false;
  private gisLoaded = false;
  private tokenClient: any = null;
  private accessToken: string | null = null;
  private state: GoogleDriveState = {
    isSignedIn: false,
    user: null,
    fileId: null
  };

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Google API script
      if (!document.querySelector('script[src*="apis.google.com/js/api.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => {
          this.gapiLoaded = true;
          this.initializeGapiClient().then(resolve).catch(reject);
        };
        script.onerror = reject;
        document.head.appendChild(script);
      } else {
        this.gapiLoaded = true;
        this.initializeGapiClient().then(resolve).catch(reject);
      }

      // Load Google Identity Services
      if (!document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
        const gisScript = document.createElement('script');
        gisScript.src = 'https://accounts.google.com/gsi/client';
        gisScript.onload = () => {
          this.gisLoaded = true;
          this.initializeGisClient();
        };
        document.head.appendChild(gisScript);
      } else {
        this.gisLoaded = true;
        this.initializeGisClient();
      }
    });
  }

  private async initializeGapiClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({
            discoveryDocs: DISCOVERY_DOCS,
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private initializeGisClient(): void {
    if (!GOOGLE_CLIENT_ID) {
      console.warn('Google Client ID not configured');
      return;
    }

    this.tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response: any) => {
        if (response.error) {
          console.error('Auth error:', response);
          return;
        }
        this.accessToken = response.access_token;
        this.state.isSignedIn = true;
        this.loadUserInfo();
      },
    });
  }

  private async loadUserInfo(): Promise<void> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const data = await response.json();
      this.state.user = { email: data.email, name: data.name };
    } catch (error) {
      console.error('Failed to load user info:', error);
    }
  }

  async signIn(): Promise<void> {
    if (!this.tokenClient) {
      await this.init();
    }
    return new Promise((resolve) => {
      this.tokenClient.callback = async (response: any) => {
        if (response.error) {
          throw new Error(response.error);
        }
        this.accessToken = response.access_token;
        this.state.isSignedIn = true;
        await this.loadUserInfo();
        resolve();
      };
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  signOut(): void {
    if (this.accessToken) {
      (window as any).google.accounts.oauth2.revoke(this.accessToken);
      this.accessToken = null;
    }
    this.state.isSignedIn = false;
    this.state.user = null;
    this.state.fileId = null;
  }

  getState(): GoogleDriveState {
    return { ...this.state };
  }

  async saveContacts(contacts: Contact[]): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Not signed in');
    }

    const content = JSON.stringify(contacts, null, 2);
    const metadata = {
      name: FILE_NAME,
      mimeType: 'application/json',
    };

    try {
      let fileId = this.state.fileId;

      if (!fileId) {
        // Search for existing file
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=appDataFolder`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        const searchData = await searchResponse.json();
        fileId = searchData.files?.[0]?.id || null;
        this.state.fileId = fileId;
      }

      if (fileId) {
        // Update existing file
        const boundary = '-------314159265358979323846';
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelim = `\r\n--${boundary}--`;

        const multipartRequestBody =
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          content +
          closeDelim;

        await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        });
      } else {
        // Create new file in appDataFolder
        const createMetadata = { ...metadata, parents: ['appDataFolder'] };
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(createMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([content], { type: 'application/json' }));

        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.accessToken}` },
            body: form,
          }
        );
        const data = await response.json();
        this.state.fileId = data.id;
      }
    } catch (error) {
      console.error('Failed to save to Drive:', error);
      throw error;
    }
  }

  async loadContacts(): Promise<Contact[]> {
    if (!this.accessToken) {
      throw new Error('Not signed in');
    }

    try {
      let fileId = this.state.fileId;

      if (!fileId) {
        // Search for file
        const searchResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}'&spaces=appDataFolder`,
          { headers: { Authorization: `Bearer ${this.accessToken}` } }
        );
        const searchData = await searchResponse.json();
        fileId = searchData.files?.[0]?.id;

        if (!fileId) {
          return []; // No file exists yet
        }
        this.state.fileId = fileId;
      }

      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!response.ok) {
        throw new Error('Failed to load from Drive');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to load from Drive:', error);
      throw error;
    }
  }
}

export const googleDrive = new GoogleDriveService();
