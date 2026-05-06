import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { Readable } from 'node:stream';
import { env } from './env';

let cachedDrive: drive_v3.Drive | null = null;
let cachedOAuth: OAuth2Client | null = null;

export function oauthClient(redirectUri?: string): OAuth2Client {
  if (!cachedOAuth || redirectUri) {
    cachedOAuth = new google.auth.OAuth2(
      env.drive.clientId,
      env.drive.clientSecret,
      redirectUri,
    );
  }
  return cachedOAuth;
}

function driveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;
  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  cachedDrive = google.drive({ version: 'v3', auth });
  return cachedDrive;
}

async function findChildFolder(parentId: string, name: string): Promise<string | null> {
  const drive = driveClient();
  const q = [
    `'${parentId}' in parents`,
    `name = '${name.replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    `trashed = false`,
  ].join(' and ');
  const res = await drive.files.list({
    q,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    pageSize: 1,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function createFolder(parentId: string, name: string): Promise<string> {
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
    supportsAllDrives: true,
  });
  return res.data.id!;
}

async function ensureFolder(parentId: string, name: string): Promise<string> {
  return (await findChildFolder(parentId, name)) ?? (await createFolder(parentId, name));
}

export async function ensurePostFolder(opts: {
  cliente: string;
  postTitulo: string;
  dataPostagem: string | null;
}): Promise<{ folderId: string; webViewLink: string }> {
  const drive = driveClient();
  const clienteFolder = await ensureFolder(env.drive.rootFolderId, sanitize(opts.cliente));
  const postFolder = await ensureFolder(clienteFolder, sanitize(opts.postTitulo));
  const dataLabel = opts.dataPostagem ?? new Date().toISOString().split('T')[0];
  const dataFolder = await ensureFolder(postFolder, dataLabel);

  const meta = await drive.files.get({
    fileId: dataFolder,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });

  return { folderId: dataFolder, webViewLink: meta.data.webViewLink! };
}

export async function uploadFile(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ id: string; webViewLink: string }> {
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: {
      name: sanitize(opts.name),
      parents: [opts.folderId],
    },
    media: {
      mimeType: opts.mimeType || 'application/octet-stream',
      body: Readable.from(opts.buffer),
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink! };
}

function sanitize(input: string): string {
  return input.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export type DriveFileResumido = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink: string | null;
  isFolder: boolean;
};

export function extractDriveFolderId(url: string): string | null {
  const m = url.match(/\/folders\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function extractDriveFileId(url: string): string | null {
  const m1 = url.match(/\/file\/d\/([^/?#]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([^&#]+)/);
  return m2 ? m2[1] : null;
}

export async function listFolderFiles(folderId: string): Promise<DriveFileResumido[]> {
  const drive = driveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    orderBy: 'name',
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? 'arquivo',
    mimeType: f.mimeType ?? '',
    webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
    thumbnailLink: f.thumbnailLink ?? null,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));
}
