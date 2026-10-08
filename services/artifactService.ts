export interface VisualArtifactProvenance {
  app: 'Hypatia';
  projectId: string;
  source: string;
  prompt: string;
  timestamp: string;
  generator: 'Designer/Gemini';
  model: string;
  path: string;
  structuredData?: unknown;
}

export async function persistGeneratedArtifact(input: Omit<VisualArtifactProvenance, 'timestamp' | 'generator' | 'path'> & { data: string; mimeType?: string }): Promise<VisualArtifactProvenance> {
  const response = await fetch('/api/artifacts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, timestamp: new Date().toISOString(), generator: 'Designer/Gemini', mimeType: input.mimeType || 'image/png' })
  });
  if (!response.ok) throw new Error(`Artifact persistence failed (${response.status})`);
  return response.json();
}
