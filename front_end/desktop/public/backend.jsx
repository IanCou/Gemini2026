// backend.jsx — real API helpers for the Sift frontend

const MIME_COLORS = {
  code:   '#4a6fc0',
  doc:    '#c0504a',
  image:  '#c09a3a',
  config: '#4a8c5c',
  misc:   '#8a5cc0',
};

const MIME_LABELS = {
  code:   'CODE',
  doc:    'DOC',
  image:  'IMG',
  config: 'CONFIG',
  misc:   'MISC',
};

const BASE = 'http://127.0.0.1:8765';

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function inferMime(filepath, fileType) {
  if (fileType && MIME_COLORS[fileType]) return fileType;
  const ext = (filepath || '').split('.').pop().toLowerCase();
  const CODE = ['ts','tsx','js','jsx','py','go','rs','java','c','cpp','cs','rb','php','swift','kt'];
  const DOC  = ['md','mdx','txt','rst','pdf','tex'];
  const IMG  = ['png','jpg','jpeg','gif','svg','webp','ico','bmp'];
  const CFG  = ['json','yaml','yml','toml','ini','env','cfg','conf','lock','xml'];
  if (CODE.includes(ext)) return 'code';
  if (DOC.includes(ext))  return 'doc';
  if (IMG.includes(ext))  return 'image';
  if (CFG.includes(ext))  return 'config';
  return 'misc';
}

function inferCluster(filepath) {
  if (!filepath) return 'root';
  const parts = filepath.replace(/\\/g, '/').split('/');
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] && parts[i] !== '.') return parts[i];
  }
  return 'root';
}

async function fetchProjects() {
  const r = await fetch(`${BASE}/api/projects`);
  const d = await r.json();
  return d.projects || [];
}

async function buildGraphFromBackend(projectRoot) {
  const pid = projectRoot || '';
  const url = `${BASE}/api/projection?query=&project=${encodeURIComponent(pid)}`;
  const r = await fetch(url);
  const d = await r.json();
  const pts = d.points || [];

  if (pts.length === 0) {
    return { nodes: [], edges: [], project: { name: pid ? pid.split(/[\\/]/).pop() : 'Workspace', description: '0 indexed files' } };
  }

  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const xMax = Math.max(...xs.map(Math.abs)) || 1;
  const yMax = Math.max(...ys.map(Math.abs)) || 1;
  const scale = 120 / Math.max(xMax, yMax);

  const nodes = pts.map((p, i) => {
    const name = p.filename || p.filepath?.split('/').pop() || `file_${i}`;
    const path = p.filepath || name;
    const mime = inferMime(path, p.file_type);
    const cluster = inferCluster(path);
    return {
      id: i,
      name,
      path,
      cluster,
      clusterIdx: 0,
      mime,
      size: 0.6 + (hashStr(name) % 100) / 100 * 1.4,
      x: p.x * scale,
      y: p.y * scale,
      z: ((hashStr(path) % 60) - 30),
      clusterCenter: { x: p.x * scale, y: p.y * scale, z: 0 },
    };
  });

  const clusterNames = [...new Set(nodes.map(n => n.cluster))];
  const clusterIdx = Object.fromEntries(clusterNames.map((c, i) => [c, i]));
  nodes.forEach(n => { n.clusterIdx = clusterIdx[n.cluster]; });

  const clusterMap = {};
  nodes.forEach(n => { (clusterMap[n.cluster] = clusterMap[n.cluster] || []).push(n); });

  const edges = [];
  let seed = 42;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  Object.values(clusterMap).forEach(group => {
    group.forEach(n => {
      const k = Math.min(2, group.length - 1);
      const seen = new Set();
      for (let i = 0; i < k * 4 && seen.size < k; i++) {
        const t = group[Math.floor(rand() * group.length)];
        if (t.id !== n.id && !seen.has(t.id)) {
          seen.add(t.id);
          edges.push({ a: n.id, b: t.id, similarity: 0.7 + rand() * 0.3 });
        }
      }
    });
  });
  const xc = Math.floor(nodes.length * 0.08);
  for (let i = 0; i < xc; i++) {
    const a = nodes[Math.floor(rand() * nodes.length)];
    const b = nodes[Math.floor(rand() * nodes.length)];
    if (a.id !== b.id && a.cluster !== b.cluster) {
      edges.push({ a: a.id, b: b.id, similarity: 0.4 + rand() * 0.3 });
    }
  }

  return {
    nodes,
    edges,
    project: { name: pid ? pid.split(/[\\/]/).pop() : 'Workspace', description: `${pts.length} indexed files` },
  };
}

async function searchFiles(query, projectRoot, graphNodes) {
  const pid = projectRoot || '';
  const url = `${BASE}/api/semantic/search?q=${encodeURIComponent(query)}&k=20&min_score=0.4${pid ? `&project=${encodeURIComponent(pid)}` : ''}`;
  const r = await fetch(url);
  const d = await r.json();
  const hits = d.hits || [];

  return hits.map((h, i) => {
    // Try to find the corresponding constellation node
    const node = graphNodes.find(n =>
      n.path === h.filepath || n.name === h.filename
    );
    // If no graph node, synthesise one for display (id < 0 = not in constellation)
    const displayNode = node || {
      id: -(i + 1),
      name: h.filename || (h.filepath || '').split('/').pop() || '?',
      path: h.filepath || h.filename || '',
      cluster: (h.filepath || '').split('/').slice(-2, -1)[0] || 'result',
      mime: inferMime(h.filepath, h.file_type),
      x: 0, y: 0, z: 0,
      clusterCenter: { x: 0, y: 0, z: 0 },
      size: 1,
    };
    return { node: displayNode, score: Math.round((h.score || 0) * 100) };
  }).filter(x => x.score > 0);
}

async function fetchFilePreview(relPath) {
  const r = await fetch(`${BASE}/api/file/preview?rel_path=${encodeURIComponent(relPath)}`);
  if (!r.ok) return null;
  const d = await r.json();
  if (d.kind === 'text' && d.content) return d.content;
  if (d.kind === 'image' && d.content) return `[ image · ${d.name} ]\n\ndata:${d.mime || 'image/png'};base64,${d.content}`;
  if (d.kind === 'pdf') return `[ PDF · ${d.name} ]\n\n${d.content || '(no text layer)'}`;
  if (d.kind === 'binary') return `[ binary · ${d.name} ]\n\n${d.message || ''}`;
  return null;
}

function streamIndexProject(projectId, onEvent) {
  const params = new URLSearchParams();
  if (projectId) params.set('project', projectId);
  const url = `${BASE}/api/index/stream${params.toString() ? '?' + params.toString() : ''}`;
  const es = new EventSource(url);
  es.addEventListener('start',  ev => onEvent('start',  JSON.parse(ev.data)));
  es.addEventListener('stage',  ev => onEvent('stage',  JSON.parse(ev.data)));
  es.addEventListener('end',    ev => { onEvent('end', JSON.parse(ev.data)); es.close(); });
  es.onerror = () => { onEvent('error', {}); es.close(); };
  return es;
}

Object.assign(window, {
  MIME_COLORS, MIME_LABELS,
  fetchProjects, buildGraphFromBackend, searchFiles, fetchFilePreview, streamIndexProject,
});
