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
    // Se duas pastas iguais nasceram juntas (uploads em paralelo), todo mundo
    // usa a MAIS ANTIGA — os arquivos não se espalham entre as duas.
    orderBy: 'createdTime',
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
  const existente = await findChildFolder(parentId, name);
  if (existente) return existente;
  const criada = await createFolder(parentId, name);
  // Relê: se outra chamada criou a mesma pasta ao mesmo tempo, fica a mais antiga.
  // (Se o Drive ainda não listar a nova, usa a que acabou de criar.)
  return (await findChildFolder(parentId, name)) ?? criada;
}

/**
 * Compartilha uma pasta com todos os admins (role: writer). Idempotente:
 * se o email já tem permissão, o Google responde com erro de duplicata que
 * a gente ignora.
 *
 * As pastas criadas pelo OAuth do portal ficam no Drive da conta da Lud.
 * (oi@lud.digital). Sem esse share, qualquer admin que clica no link do
 * Drive vê "sem permissão" / tela preta — porque o browser dele está logado
 * em outra conta Google.
 *
 * Memoiza em escopo de módulo pra não refazer a cada ensurePostFolder.
 */
const foldersCompartilhados = new Set<string>();
async function compartilharComAdmins(folderId: string): Promise<void> {
  if (foldersCompartilhados.has(folderId)) return;
  const emails = env.auth.adminEmails;
  if (emails.length === 0) {
    foldersCompartilhados.add(folderId);
    return;
  }
  const drive = driveClient();
  await Promise.all(
    emails.map(async (email) => {
      try {
        await drive.permissions.create({
          fileId: folderId,
          requestBody: { role: 'writer', type: 'user', emailAddress: email },
          sendNotificationEmail: false,
          supportsAllDrives: true,
        });
      } catch (err: any) {
        // 400 "already has access" ou similar — ignora, é idempotente.
        const msg = String(err?.message ?? '').toLowerCase();
        if (!msg.includes('already') && !msg.includes('duplicate')) {
          console.warn(
            `[drive] falha ao compartilhar ${folderId} com ${email}:`,
            err?.message,
          );
        }
      }
    }),
  );
  foldersCompartilhados.add(folderId);
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

  // Garante que os admins conseguem abrir o link no Drive. Idempotente —
  // só manda share na primeira vez por folderId (cache em memória).
  // Compartilha a RAIZ — todas as pastas filhas (cliente, post, data) herdam
  // acesso automaticamente. Uma única operação por processo.
  await compartilharComAdmins(env.drive.rootFolderId);

  const meta = await drive.files.get({
    fileId: dataFolder,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });

  return { folderId: dataFolder, webViewLink: meta.data.webViewLink! };
}

/**
 * Pasta de materiais gerais do cliente (envios livres, fora de um post).
 * `[Cliente]/Materiais do cliente/`
 */
export async function ensureMateriaisFolder(
  cliente: string,
): Promise<{ folderId: string; webViewLink: string }> {
  const drive = driveClient();
  const clienteFolder = await ensureFolder(env.drive.rootFolderId, sanitize(cliente));
  const matFolder = await ensureFolder(clienteFolder, 'Materiais do cliente');
  const meta = await drive.files.get({
    fileId: matFolder,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });
  return { folderId: matFolder, webViewLink: meta.data.webViewLink! };
}

/**
 * Cria uma sessão de upload RESUMABLE do Drive e devolve a URL de sessão.
 * O browser depois faz PUT direto nessa URL, sem passar pelo Vercel — assim
 * escapa do limite de 4.5 MB por request de serverless. Sessão é do Drive
 * corporativo da Lud. (usa o mesmo refresh token do resto do módulo), então
 * o cliente NÃO precisa autenticar no Google.
 *
 * A URL de sessão é única por arquivo e expira em ~1 semana (Google).
 *
 * Docs: https://developers.google.com/drive/api/guides/manage-uploads#resumable
 */
export async function criarUploadSession(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
}): Promise<{ uploadUrl: string; nomeFinal: string }> {
  const nomeFinal = sanitize(opts.name);
  const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
  auth.setCredentials({ refresh_token: env.drive.refreshToken });
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error('Sem access token do Drive');

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': opts.mimeType || 'application/octet-stream',
        'X-Upload-Content-Length': String(opts.size),
      },
      body: JSON.stringify({
        name: nomeFinal,
        parents: [opts.folderId],
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Drive resumable init falhou (${res.status}): ${body.slice(0, 200)}`);
  }

  const uploadUrl = res.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Drive não retornou URL de sessão resumable');
  }
  return { uploadUrl, nomeFinal };
}

/**
 * Sobe um arquivo pro Drive DIRETO de um Readable stream (sem carregar
 * tudo em memória). Usado quando o arquivo vem de outra fonte pra proxy
 * (ex: Vercel Blob → Drive). Se tiver Buffer em vez de stream, use
 * `uploadFile` normal — este é pra arquivos grandes.
 */
export async function uploadFileFromStream(opts: {
  folderId: string;
  name: string;
  mimeType: string;
  body: Readable;
}): Promise<{ id: string; webViewLink: string }> {
  const drive = driveClient();
  const res = await drive.files.create({
    requestBody: {
      name: sanitize(opts.name),
      parents: [opts.folderId],
    },
    media: {
      mimeType: opts.mimeType || 'application/octet-stream',
      body: opts.body,
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });
  return { id: res.data.id!, webViewLink: res.data.webViewLink! };
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
  /** Quando o arquivo chegou no Drive (ISO). */
  criadoEm?: string | null;
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

export type MaterialBanco = {
  cliente: string;
  arquivos: DriveFileResumido[];
};

/**
 * Varre as pastas "Materiais do cliente" de cada cliente no Drive e devolve
 * os arquivos enviados — alimenta a seção Banco de materiais do admin.
 */
export async function listMateriaisDoBanco(): Promise<MaterialBanco[]> {
  const raiz = await listFolderFiles(env.drive.rootFolderId);
  const clienteFolders = raiz.filter((f) => f.isFolder);

  const resultados = await Promise.all(
    clienteFolders.map(async (cf): Promise<MaterialBanco | null> => {
      try {
        const dentro = await listFolderFiles(cf.id);
        const matFolder = dentro.find(
          (x) => x.isFolder && x.name === 'Materiais do cliente',
        );
        if (!matFolder) return null;
        const arquivos = (await listFolderFiles(matFolder.id)).filter(
          (x) => !x.isFolder,
        );
        if (arquivos.length === 0) return null;
        return { cliente: cf.name, arquivos };
      } catch {
        return null;
      }
    }),
  );

  return resultados
    .filter((r): r is MaterialBanco => r !== null)
    .sort((a, b) => a.cliente.localeCompare(b.cliente, 'pt-BR'));
}

/** Collator com natural sort (numeric-aware): "sm_carrossel_2.jpg" vem
 *  antes de "sm_carrossel_10.jpg", em vez da ordem alfabética burra que
 *  o Drive API retorna por padrão. Cache do collator em módulo. */
const NATURAL_COLLATOR = new Intl.Collator('pt-BR', {
  numeric: true,
  sensitivity: 'base',
});

export async function listFolderFiles(folderId: string): Promise<DriveFileResumido[]> {
  const drive = driveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id,name,mimeType,webViewLink,thumbnailLink,createdTime)',
    pageSize: 200,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    // name_natural = natural sort no lado do Google (respeita números).
    // Ainda aplicamos Collator abaixo como garantia — em algumas contas o
    // Drive API não respeita name_natural e cai pra alfabético.
    orderBy: 'name_natural',
  });
  const arquivos = (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? 'arquivo',
    mimeType: f.mimeType ?? '',
    criadoEm: f.createdTime ?? null,
    webViewLink: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
    thumbnailLink: f.thumbnailLink ?? null,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));
  arquivos.sort((a, b) => NATURAL_COLLATOR.compare(a.name, b.name));
  return arquivos;
}

/** Subpasta dos materiais que o cliente envia, separada da arte do post. */
export const PASTA_MATERIAIS_DO_POST = 'Materiais do cliente';

/** `[Cliente]/[Post]/[data]/Materiais do cliente` — cria se não existir. */
const pastaMateriaisCache = new Map<string, { ts: number; pasta: { folderId: string; webViewLink: string } }>();

export async function ensurePastaMateriaisDoPost(opts: {
  cliente: string;
  postTitulo: string;
  dataPostagem: string | null;
}): Promise<{ folderId: string; webViewLink: string }> {
  // Um envio com 40 arquivos chama isso 40 vezes: guarda a pasta por 10 min.
  const chave = `${opts.cliente}|${opts.postTitulo}|${opts.dataPostagem ?? ''}`;
  const hit = pastaMateriaisCache.get(chave);
  if (hit && Date.now() - hit.ts < 10 * 60_000) return hit.pasta;
  const pasta = await criarPastaMateriaisDoPost(opts);
  pastaMateriaisCache.set(chave, { ts: Date.now(), pasta });
  return pasta;
}

async function criarPastaMateriaisDoPost(opts: {
  cliente: string;
  postTitulo: string;
  dataPostagem: string | null;
}): Promise<{ folderId: string; webViewLink: string }> {
  const base = await ensurePostFolder(opts);
  const folderId = await ensureFolder(base.folderId, PASTA_MATERIAIS_DO_POST);
  const meta = await driveClient().files.get({
    fileId: folderId,
    fields: 'webViewLink',
    supportsAllDrives: true,
  });
  return { folderId, webViewLink: meta.data.webViewLink! };
}

/** Arquivos da pasta de materiais do post, sem criar nada no Drive. */
export async function listarMateriaisDoPost(opts: {
  cliente: string;
  postTitulo: string;
  dataPostagem: string | null;
}): Promise<DriveFileResumido[]> {
  if (!opts.dataPostagem) return [];
  const cliente = await findChildFolder(env.drive.rootFolderId, sanitize(opts.cliente));
  if (!cliente) return [];
  const post = await findChildFolder(cliente, sanitize(opts.postTitulo));
  if (!post) return [];
  const data = await findChildFolder(post, opts.dataPostagem);
  if (!data) return [];
  const pasta = await findChildFolder(data, PASTA_MATERIAIS_DO_POST);
  if (!pasta) return [];
  return (await listFolderFiles(pasta)).filter((f) => !f.isFolder);
}
