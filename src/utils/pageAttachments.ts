export type PageAttachmentKind = 'image' | 'google-form' | 'google-sheet' | 'youtube' | 'google-drive' | 'google-slide';

export interface PageAttachmentItem {
  id: string;
  title: string;
  kind?: PageAttachmentKind;
  url: string;
  sourceUrl?: string;
  storagePath?: string;
}

export const normalizePageAttachmentKind = (kind?: string | null): PageAttachmentKind => {
  if (kind === 'google-form' || kind === 'google-sheet' || kind === 'youtube' || kind === 'google-drive' || kind === 'google-slide') return kind;
  return 'image';
};

const extractYouTubeId = (input: string) => {
  const match = input.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#&?]*).*/);
  return match && match[2] ? match[2] : '';
};

const ensureQueryParam = (url: string, key: string, value: string) => {
  const parsed = new URL(url);
  if (!parsed.searchParams.has(key)) {
    parsed.searchParams.set(key, value);
  }
  return parsed.toString();
};

const extractDriveFileId = (input: string) => {
  const fileMatch = input.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return fileMatch[1];
  const idMatch = input.match(/[?&]id=([^&#]+)/);
  return idMatch?.[1] || '';
};

const extractDriveFolderId = (input: string) => {
  const folderMatch = input.match(/\/folders\/([^/?#]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const idMatch = input.match(/[?&]id=([^&#]+)/);
  return idMatch?.[1] || '';
};

export const buildPageAttachmentEmbedUrl = (kind: PageAttachmentKind, inputUrl: string) => {
  const url = inputUrl.trim();
  if (!url) return '';

  if (kind === 'youtube') {
    const videoId = extractYouTubeId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }

  if (kind === 'google-form') {
    if (!url.includes('docs.google.com/forms/')) return url;
    if (url.includes('/viewform')) {
      return ensureQueryParam(url, 'embedded', 'true');
    }
    return `${url}${url.includes('?') ? '&' : '?'}embedded=true`;
  }

  if (kind === 'google-sheet') {
    if (!url.includes('docs.google.com/spreadsheets/')) return url;
    if (url.includes('/pubhtml')) return url;
    const sheetIdMatch = url.match(/\/spreadsheets\/d\/([^/]+)/);
    const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
    if (!sheetIdMatch) return url;
    const gid = gidMatch?.[1] || '0';
    return `https://docs.google.com/spreadsheets/d/${sheetIdMatch[1]}/pubhtml?gid=${gid}&single=true&widget=true&headers=false`;
  }

  if (kind === 'google-slide') {
    if (!url.includes('docs.google.com/presentation/')) return url;
    if (url.includes('/embed')) return url;
    const presentationIdMatch = url.match(/\/presentation\/d\/([^/]+)/);
    if (!presentationIdMatch) return url;
    return `https://docs.google.com/presentation/d/${presentationIdMatch[1]}/embed?start=false&loop=false&delayms=3000`;
  }

  if (kind === 'google-drive') {
    if (!url.includes('drive.google.com/')) return url;
    if (url.includes('/preview') || url.includes('/embeddedfolderview')) return url;
    if (url.includes('/folders/')) {
      const folderId = extractDriveFolderId(url);
      return folderId ? `https://drive.google.com/embeddedfolderview?id=${folderId}#grid` : url;
    }
    const fileId = extractDriveFileId(url);
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : url;
  }

  return url;
};

export const getPageAttachmentFrameHeight = (kind: PageAttachmentKind) => {
  switch (kind) {
    case 'google-form':
      return '920px';
    case 'google-sheet':
      return '760px';
    case 'youtube':
      return '560px';
    case 'google-drive':
      return '760px';
    case 'google-slide':
      return '560px';
    default:
      return 'auto';
  }
};
