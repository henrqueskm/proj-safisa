const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const uploadFile = async (bucket: string, path: string, file: File) => {
  const response = await fetch(`${apiBaseUrl}/api/storage/${encodeURIComponent(bucket)}/${encodeURI(path)}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    },
    body: await file.arrayBuffer()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Erro ao enviar arquivo.');
  }

  return payload.publicUrl as string;
};
