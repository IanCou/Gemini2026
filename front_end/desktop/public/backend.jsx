// sample-data.jsx
// Sample project trees for the Nebula prototype. Each project produces ~150–200 nodes.
// MIME categories: code | image | doc | config | misc

const MIME_COLORS = {
  code:   '#4a6fc0', // cobalt
  doc:    '#c0504a', // coral
  image:  '#c09a3a', // amber
  config: '#4a8c5c', // sage
  misc:   '#8a5cc0', // soft violet
};

const MIME_LABELS = {
  code:   'CODE',
  doc:    'DOC',
  image:  'IMG',
  config: 'CONFIG',
  misc:   'MISC',
};

// Cluster definitions: { name, mime, prefix, files }
// Each cluster represents a semantic group. Files within drift toward each other.
const PROJECTS = {
  webapp: {
    name: 'orbit-webapp',
    description: 'A typical React + TypeScript SPA',
    clusters: [
      {
        name: 'auth',
        mime: 'code',
        path: 'src/features/auth',
        files: [
          'LoginForm.tsx', 'SignupForm.tsx', 'PasswordReset.tsx',
          'OAuthButtons.tsx', 'useAuth.ts', 'authSlice.ts',
          'tokenStorage.ts', 'sessionGuard.ts', 'authApi.ts',
          'AuthProvider.tsx', 'protectedRoute.tsx', 'mfaChallenge.tsx',
        ],
      },
      {
        name: 'dashboard',
        mime: 'code',
        path: 'src/features/dashboard',
        files: [
          'DashboardLayout.tsx', 'MetricsCard.tsx', 'ActivityFeed.tsx',
          'KPIWidget.tsx', 'ChartPanel.tsx', 'useMetrics.ts',
          'dashboardSlice.ts', 'TimeRangePicker.tsx', 'ExportMenu.tsx',
        ],
      },
      {
        name: 'billing',
        mime: 'code',
        path: 'src/features/billing',
        files: [
          'PricingTable.tsx', 'CheckoutForm.tsx', 'InvoiceList.tsx',
          'CardInput.tsx', 'useSubscription.ts', 'billingApi.ts',
          'stripeAdapter.ts', 'PlanComparison.tsx', 'UsageMeter.tsx',
        ],
      },
      {
        name: 'settings',
        mime: 'code',
        path: 'src/features/settings',
        files: [
          'SettingsPage.tsx', 'ProfileTab.tsx', 'NotificationsTab.tsx',
          'IntegrationsTab.tsx', 'TeamTab.tsx', 'useSettings.ts',
          'settingsSlice.ts', 'ApiKeyManager.tsx',
        ],
      },
      {
        name: 'ui-kit',
        mime: 'code',
        path: 'src/components',
        files: [
          'Button.tsx', 'Input.tsx', 'Select.tsx', 'Modal.tsx',
          'Tooltip.tsx', 'Drawer.tsx', 'Tabs.tsx', 'Badge.tsx',
          'Avatar.tsx', 'Spinner.tsx', 'Toast.tsx', 'Popover.tsx',
          'DataTable.tsx', 'Card.tsx', 'EmptyState.tsx',
        ],
      },
      {
        name: 'hooks',
        mime: 'code',
        path: 'src/hooks',
        files: [
          'useDebounce.ts', 'useThrottle.ts', 'useLocalStorage.ts',
          'useMediaQuery.ts', 'useClickOutside.ts', 'useKeyPress.ts',
          'useInterval.ts', 'usePrevious.ts',
        ],
      },
      {
        name: 'utils',
        mime: 'code',
        path: 'src/lib',
        files: [
          'formatDate.ts', 'formatCurrency.ts', 'parseQuery.ts',
          'classNames.ts', 'fetcher.ts', 'errorHandler.ts',
          'validators.ts', 'logger.ts', 'tracing.ts',
        ],
      },
      {
        name: 'styles',
        mime: 'code',
        path: 'src/styles',
        files: [
          'globals.css', 'tokens.css', 'reset.css',
          'animations.css', 'typography.css', 'theme.dark.css',
          'theme.light.css',
        ],
      },
      {
        name: 'tests',
        mime: 'code',
        path: 'tests',
        files: [
          'auth.test.ts', 'billing.test.ts', 'dashboard.test.ts',
          'utils.test.ts', 'components.test.tsx', 'integration.test.ts',
          'e2e.spec.ts', 'fixtures.ts', 'setup.ts',
        ],
      },
      {
        name: 'config',
        mime: 'config',
        path: '',
        files: [
          'package.json', 'tsconfig.json', 'vite.config.ts',
          'tailwind.config.js', 'postcss.config.js', 'eslint.config.js',
          '.prettierrc', 'vitest.config.ts', 'playwright.config.ts',
        ],
      },
      {
        name: 'env',
        mime: 'config',
        path: '',
        files: [
          '.env', '.env.local', '.env.production', '.env.test',
          '.gitignore', '.dockerignore', 'Dockerfile', 'docker-compose.yml',
        ],
      },
      {
        name: 'docs',
        mime: 'doc',
        path: 'docs',
        files: [
          'README.md', 'CONTRIBUTING.md', 'ARCHITECTURE.md',
          'API.md', 'DEPLOYMENT.md', 'CHANGELOG.md',
          'LICENSE', 'auth-flow.md', 'data-model.md',
        ],
      },
      {
        name: 'assets',
        mime: 'image',
        path: 'public/assets',
        files: [
          'logo.svg', 'logo-dark.svg', 'favicon.png', 'og-image.png',
          'hero-bg.jpg', 'illustration-empty.svg', 'avatar-default.png',
          'icon-sprite.svg', 'pattern.svg',
        ],
      },
      {
        name: 'data',
        mime: 'misc',
        path: 'src/data',
        files: [
          'countries.json', 'timezones.json', 'currencies.json',
          'plans.json', 'mockUsers.json', 'seed.ts',
        ],
      },
      {
        name: 'api',
        mime: 'code',
        path: 'src/api',
        files: [
          'client.ts', 'endpoints.ts', 'queryKeys.ts',
          'usersApi.ts', 'projectsApi.ts', 'webhooksApi.ts',
          'middleware.ts', 'interceptors.ts',
        ],
      },
      {
        name: 'routes',
        mime: 'code',
        path: 'src/routes',
        files: [
          'router.tsx', 'routes.ts', 'navigation.ts',
          'breadcrumbs.tsx', 'lazyRoutes.ts',
        ],
      },
    ],
  },

  ml: {
    name: 'corpus-ml',
    description: 'Python ML training pipeline',
    clusters: [
      {
        name: 'training',
        mime: 'code',
        path: 'src/training',
        files: [
          'trainer.py', 'optimizer.py', 'scheduler.py', 'loss.py',
          'metrics.py', 'callbacks.py', 'distributed.py', 'mixed_precision.py',
          'gradient_accumulation.py', 'checkpoint.py',
        ],
      },
      {
        name: 'models',
        mime: 'code',
        path: 'src/models',
        files: [
          'transformer.py', 'attention.py', 'embeddings.py',
          'positional.py', 'layernorm.py', 'mlp.py',
          'tokenizer.py', 'classifier.py',
        ],
      },
      {
        name: 'data',
        mime: 'code',
        path: 'src/data',
        files: [
          'dataset.py', 'dataloader.py', 'preprocessing.py',
          'augmentation.py', 'sampler.py', 'collator.py',
          'streaming.py', 'cache.py',
        ],
      },
      {
        name: 'eval',
        mime: 'code',
        path: 'src/eval',
        files: [
          'evaluate.py', 'benchmark.py', 'leaderboard.py',
          'compare_models.py', 'human_eval.py',
        ],
      },
      {
        name: 'notebooks',
        mime: 'misc',
        path: 'notebooks',
        files: [
          'exploration.ipynb', 'baseline.ipynb', 'analysis.ipynb',
          'visualization.ipynb', 'error_analysis.ipynb',
        ],
      },
      {
        name: 'configs',
        mime: 'config',
        path: 'configs',
        files: [
          'base.yaml', 'small.yaml', 'medium.yaml', 'large.yaml',
          'data.yaml', 'eval.yaml', 'sweep.yaml',
        ],
      },
      {
        name: 'datasets',
        mime: 'misc',
        path: 'data',
        files: [
          'train.parquet', 'val.parquet', 'test.parquet',
          'vocab.json', 'splits.json',
        ],
      },
      {
        name: 'figures',
        mime: 'image',
        path: 'figures',
        files: [
          'loss_curve.png', 'attention_map.png', 'confusion_matrix.png',
          'embedding_tsne.png', 'architecture.svg',
        ],
      },
      {
        name: 'docs',
        mime: 'doc',
        path: 'docs',
        files: [
          'README.md', 'TRAINING.md', 'paper.tex', 'model_card.md',
          'experiments.md',
        ],
      },
      {
        name: 'project',
        mime: 'config',
        path: '',
        files: [
          'pyproject.toml', 'requirements.txt', 'requirements-dev.txt',
          'Makefile', '.gitignore', 'setup.cfg',
        ],
      },
    ],
  },

  monorepo: {
    name: 'fleet-monorepo',
    description: 'Mixed TS + Go monorepo',
    clusters: [
      {
        name: 'web',
        mime: 'code',
        path: 'apps/web/src',
        files: [
          'App.tsx', 'main.tsx', 'router.tsx', 'layout.tsx',
          'home.tsx', 'profile.tsx', 'admin.tsx', 'reports.tsx',
        ],
      },
      {
        name: 'mobile',
        mime: 'code',
        path: 'apps/mobile/src',
        files: [
          'App.tsx', 'screens.tsx', 'navigation.tsx',
          'home.screen.tsx', 'feed.screen.tsx', 'profile.screen.tsx',
        ],
      },
      {
        name: 'api-gateway',
        mime: 'code',
        path: 'services/gateway',
        files: [
          'main.go', 'router.go', 'middleware.go', 'auth.go',
          'rate_limit.go', 'proxy.go', 'logging.go',
        ],
      },
      {
        name: 'fleet-service',
        mime: 'code',
        path: 'services/fleet',
        files: [
          'main.go', 'handlers.go', 'vehicle.go', 'route.go',
          'tracker.go', 'dispatch.go', 'storage.go',
        ],
      },
      {
        name: 'shared-ui',
        mime: 'code',
        path: 'packages/ui/src',
        files: [
          'Button.tsx', 'Input.tsx', 'Card.tsx', 'Map.tsx',
          'Chart.tsx', 'Table.tsx', 'tokens.ts',
        ],
      },
      {
        name: 'shared-types',
        mime: 'code',
        path: 'packages/types/src',
        files: [
          'index.ts', 'vehicle.ts', 'route.ts', 'driver.ts',
          'event.ts', 'api.ts',
        ],
      },
      {
        name: 'infra',
        mime: 'config',
        path: 'infra',
        files: [
          'main.tf', 'variables.tf', 'outputs.tf',
          'k8s.yaml', 'helm-values.yaml', 'Dockerfile.web',
          'Dockerfile.api', 'docker-compose.yml',
        ],
      },
      {
        name: 'ci',
        mime: 'config',
        path: '.github/workflows',
        files: [
          'ci.yml', 'deploy.yml', 'release.yml',
          'codeql.yml', 'preview.yml',
        ],
      },
      {
        name: 'docs',
        mime: 'doc',
        path: 'docs',
        files: [
          'README.md', 'ARCHITECTURE.md', 'CONTRIBUTING.md',
          'runbook.md', 'oncall.md', 'incidents.md',
        ],
      },
      {
        name: 'design',
        mime: 'image',
        path: 'design',
        files: [
          'logo.svg', 'wordmark.svg', 'icons.svg',
          'fleet-hero.png', 'mobile-mockup.png', 'screenshot-dashboard.png',
        ],
      },
      {
        name: 'config',
        mime: 'config',
        path: '',
        files: [
          'package.json', 'pnpm-workspace.yaml', 'turbo.json',
          'tsconfig.base.json', '.eslintrc.js', '.prettierrc',
        ],
      },
      {
        name: 'scripts',
        mime: 'code',
        path: 'scripts',
        files: [
          'bootstrap.sh', 'release.sh', 'migrate.sh',
          'seed.ts', 'codegen.ts',
        ],
      },
    ],
  },
};

// Position files in 3D space using cluster centers + jitter, with cross-cluster edges
// for "semantic similarity." Deterministic per-project so the layout is stable.
function buildGraph(projectKey) {
  const proj = PROJECTS[projectKey];
  const nodes = [];
  const edges = [];

  // Pseudo-random with seed for stability
  let seed = 1;
  for (let i = 0; i < projectKey.length; i++) seed = (seed * 31 + projectKey.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // Distribute clusters on a sphere
  const clusterCount = proj.clusters.length;
  const clusterCenters = [];
  for (let i = 0; i < clusterCount; i++) {
    // Fibonacci sphere distribution for even spread
    const phi = Math.acos(1 - 2 * (i + 0.5) / clusterCount);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const r = 60 + rand() * 20;
    clusterCenters.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta) * 0.7, // squish vertically
      z: r * Math.cos(phi),
    });
  }

  // Place nodes near their cluster center
  proj.clusters.forEach((cluster, ci) => {
    const center = clusterCenters[ci];
    cluster.files.forEach((filename) => {
      // Jitter within cluster
      const jr = 8 + rand() * 6;
      const jt = rand() * Math.PI * 2;
      const jp = rand() * Math.PI - Math.PI / 2;
      const node = {
        id: nodes.length,
        name: filename,
        path: cluster.path ? `${cluster.path}/${filename}` : filename,
        cluster: cluster.name,
        clusterIdx: ci,
        mime: cluster.mime,
        // Size based on a hash of filename (proxy for file size in bytes)
        size: 0.6 + (hashStr(filename) % 100) / 100 * 1.4,
        x: center.x + jr * Math.cos(jt) * Math.cos(jp),
        y: center.y + jr * Math.sin(jp),
        z: center.z + jr * Math.sin(jt) * Math.cos(jp),
        clusterCenter: center,
      };
      nodes.push(node);
    });
  });

  // Build edges: within-cluster (high similarity) + a few cross-cluster
  const clusterNodes = {};
  nodes.forEach((n) => {
    (clusterNodes[n.cluster] = clusterNodes[n.cluster] || []).push(n);
  });

  Object.values(clusterNodes).forEach((group) => {
    // Each node connects to 2-3 others in its cluster
    group.forEach((n) => {
      const k = 2 + Math.floor(rand() * 2);
      const targets = new Set();
      for (let i = 0; i < k * 2 && targets.size < k; i++) {
        const t = group[Math.floor(rand() * group.length)];
        if (t.id !== n.id) targets.add(t.id);
      }
      targets.forEach((tid) => {
        edges.push({ a: n.id, b: tid, similarity: 0.7 + rand() * 0.3 });
      });
    });
  });

  // A handful of cross-cluster edges (semantic neighbors across folders)
  const xCount = Math.floor(nodes.length * 0.15);
  for (let i = 0; i < xCount; i++) {
    const a = nodes[Math.floor(rand() * nodes.length)];
    const b = nodes[Math.floor(rand() * nodes.length)];
    if (a.id !== b.id && a.cluster !== b.cluster) {
      edges.push({ a: a.id, b: b.id, similarity: 0.4 + rand() * 0.3 });
    }
  }

  return { nodes, edges, project: proj };
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Lorem-style content generator keyed by mime type so previews vary plausibly
function generatePreview(node) {
  const ext = node.name.split('.').pop().toLowerCase();
  const base = pascalize(node.name);
  // Repeat factor based on file size (some files are short, others scroll)
  const reps = Math.max(1, Math.round(node.size * 3));

  if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
    let body = `import { useState, useEffect, useMemo, useCallback } from 'react';
import { ${capitalize(node.cluster)}, ${capitalize(node.cluster)}Config } from '@/types';
import { fetcher, logger } from '@/lib';
import { useAuth } from '@/features/auth';

// ${node.name} — ${node.cluster} module
// Lorem ipsum dolor sit amet, consectetur adipiscing elit.
// Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

export interface ${base}Props {
  id: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onSelect?: (item: ${capitalize(node.cluster)}) => void;
}

export function ${base}({ id, variant = 'primary', onSelect }: ${base}Props) {
  const [state, setState] = useState<${capitalize(node.cluster)} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const handlers = useMemo(() => ({
    refresh: async () => {
      setLoading(true);
      try {
        const data = await fetchData(id);
        setState(data);
      } catch (e) {
        setError(e as Error);
        logger.error('${node.name}', e);
      } finally {
        setLoading(false);
      }
    },
  }), [id]);

  useEffect(() => {
    // Sed do eiusmod tempor incididunt ut labore et dolore.
    handlers.refresh();
  }, [handlers]);

  const onClick = useCallback(() => {
    if (state && onSelect) onSelect(state);
  }, [state, onSelect]);

  if (loading) return null;
  if (error) return <div className="error">{error.message}</div>;
  return (
    <div className="${node.cluster}" data-variant={variant} onClick={onClick}>
      {state?.name ?? 'Loading…'}
    </div>
  );
}

`;
    for (let i = 0; i < reps; i++) {
      body += `// ─────── helper section ${i + 1} ───────────────────────────
async function helper${i}(input: string) {
  // Ut enim ad minim veniam, quis nostrud exercitation ullamco
  // laboris nisi ut aliquip ex ea commodo consequat.
  const res = await fetcher.get(\`/api/${node.cluster}/\${input}\`);
  if (!res.ok) throw new Error(\`Failed: \${res.status}\`);
  return res.json();
}

`;
    }
    body += `async function fetchData(id: string) {
  // Duis aute irure dolor in reprehenderit in voluptate.
  return fetcher.get(\`/api/${node.cluster}/\${id}\`).then(r => r.json());
}
`;
    return body;
  }
  if (['py'].includes(ext)) {
    let body = `"""${node.name} — ${node.cluster} module.

Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna.
"""

import torch
from torch import nn
from typing import Optional, List, Dict


class ${base}(nn.Module):
    """Lorem ipsum dolor sit amet."""

    def __init__(self, dim: int = 512, num_heads: int = 8, dropout: float = 0.1):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.proj = nn.Linear(dim, dim)
        self.norm = nn.LayerNorm(dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor, mask: Optional[torch.Tensor] = None) -> torch.Tensor:
        # Duis aute irure dolor in reprehenderit in voluptate.
        x = self.norm(x)
        x = self.proj(x)
        x = self.dropout(x)
        if mask is not None:
            x = x.masked_fill(mask == 0, float('-inf'))
        return x


`;
    for (let i = 0; i < reps; i++) {
      body += `def utility_${i}(tensor: torch.Tensor) -> torch.Tensor:
    """Helper ${i} — lorem ipsum dolor sit amet."""
    # Excepteur sint occaecat cupidatat non proident.
    return tensor.mean(dim=-1, keepdim=True)


`;
    }
    return body;
  }
  if (['go'].includes(ext)) {
    let body = `package ${node.cluster.replace(/-/g, '')}

import (
    "context"
    "fmt"
    "log"
    "time"
)

// ${base} — ${node.cluster}
// Lorem ipsum dolor sit amet, consectetur adipiscing elit.

type ${base} struct {
    ID        string
    Name      string
    CreatedAt time.Time
}

func New${base}(ctx context.Context, id string) (*${base}, error) {
    log.Printf("creating ${node.cluster} %s", id)
    return &${base}{
        ID:        id,
        CreatedAt: time.Now(),
    }, nil
}

`;
    for (let i = 0; i < reps; i++) {
      body += `func (s *${base}) Method${i}(ctx context.Context) error {
    // Sed do eiusmod tempor incididunt ut labore.
    select {
    case <-ctx.Done():
        return ctx.Err()
    case <-time.After(time.Millisecond):
        return nil
    }
}

`;
    }
    body += `func (s *${base}) String() string {
    return fmt.Sprintf("${base}(%s)", s.ID)
}
`;
    return body;
  }
  if (['md', 'mdx'].includes(ext)) {
    let body = `# ${node.name.replace(/\.[^.]+$/, '')}

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Overview

Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris
nisi ut aliquip ex ea commodo consequat.

`;
    for (let i = 0; i < reps; i++) {
      body += `## Section ${i + 1}

Duis aute irure dolor in reprehenderit in voluptate velit esse
cillum dolore eu fugiat nulla pariatur.

- Excepteur sint occaecat cupidatat non proident
- Sunt in culpa qui officia deserunt mollit anim
- Id est laborum et dolorum fuga harum quidem

\`\`\`ts
function example${i}() {
  return ${i};
}
\`\`\`

`;
    }
    return body;
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(ext)) {
    return `{
  "name": "${node.name}",
  "description": "Lorem ipsum dolor sit amet",
  "version": "1.4.2",
  "main": "index.js",
  "license": "MIT",
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.0"
  },
  "devDependencies": {
    "vitest": "^1.4.0",
    "playwright": "^1.42.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0"
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}`;
  }
  if (['css', 'scss'].includes(ext)) {
    let body = `/* ${node.name} — Lorem ipsum styles */

:root {
  --bg: #0a0a0f;
  --surface: #12111a;
  --accent: #4a90d9;
  --text: #c8c4d8;
}

`;
    for (let i = 0; i < reps; i++) {
      body += `.${node.cluster}-${i} {
  background: var(--bg);
  color: var(--text);
  padding: 1rem 1.5rem;
  border-radius: 8px;
  border: 1px solid var(--surface);
}

`;
    }
    return body;
  }
  if (['svg', 'png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
    return `[ binary asset · ${node.name} ]\n\nLorem ipsum dolor sit amet — visual asset preview unavailable.\nDimensions: 1024 × 768 px\nSize: 248 KB\nLast modified: 2 days ago`;
  }
  return `${node.name}\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\nSed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function pascalize(s) {
  return s.replace(/\.[^.]+$/, '').replace(/(^|[-_./])(\w)/g, (_, __, c) => c.toUpperCase());
}

// ─── Real backend API helpers ──────────────────────────────────────────────
const BASE = 'http://127.0.0.1:8765';

async function fetchProjects() {
  const r = await fetch(`${BASE}/api/projects`);
  const d = await r.json();
  return d.projects || [];
}

// Map file extension / file_type string to a MIME category key
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

// Infer a cluster label from the file path (use the most specific directory)
function inferCluster(filepath) {
  if (!filepath) return 'root';
  const parts = filepath.replace(/\\/g, '/').split('/');
  // Drop filename, take the deepest directory segment
  for (let i = parts.length - 2; i >= 0; i--) {
    if (parts[i] && parts[i] !== '.') return parts[i];
  }
  return 'root';
}

// Build a graph from the real backend projection endpoint.
// Falls back to the demo buildGraph('webapp') if the backend returns < 2 nodes.
async function buildGraphFromBackend(projectRoot) {
  const pid = projectRoot || '';
  const url = `${BASE}/api/projection?query=&project=${encodeURIComponent(pid)}`;
  const r = await fetch(url);
  const d = await r.json();
  const pts = d.points || [];

  if (pts.length < 2) return buildGraph('webapp');

  // Scale projection coords to ±120 (same range as demo data)
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

  // Assign numeric clusterIdx per unique cluster name
  const clusterNames = [...new Set(nodes.map(n => n.cluster))];
  const clusterIdx = Object.fromEntries(clusterNames.map((c, i) => [c, i]));
  nodes.forEach(n => { n.clusterIdx = clusterIdx[n.cluster]; });

  // Build edges: within-cluster neighbours + a few cross-cluster
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

// Real semantic search — returns nodes from the current graph that match hits
async function searchFiles(query, projectRoot, graphNodes) {
  const pid = projectRoot || '';
  const url = `${BASE}/api/semantic/search?q=${encodeURIComponent(query)}&k=20${pid ? `&project=${encodeURIComponent(pid)}` : ''}`;
  const r = await fetch(url);
  const d = await r.json();
  const hits = d.hits || [];

  // Map each hit back to a graph node (match by filepath or filename)
  const scored = [];
  hits.forEach(h => {
    const node = graphNodes.find(n =>
      n.path === h.filepath || n.path === h.filename || n.name === h.filename
    );
    if (node) scored.push({ node, score: Math.round(h.score * 100) });
  });
  return scored;
}

// Real file preview
async function fetchFilePreview(relPath) {
  const r = await fetch(`${BASE}/api/file/preview?rel_path=${encodeURIComponent(relPath)}`);
  if (!r.ok) return null;
  const d = await r.json();
  if (d.type === 'text' && d.content) return d.content;
  if (d.type === 'image' && d.base64) return `[ image · ${relPath} ]\n\nBase64-encoded image (${d.mime_type || 'image'})`;
  if (d.type === 'pdf') return `[ PDF · ${relPath} ]\n\n${d.content || '(no text layer)'}`;
  return null;
}

Object.assign(window, {
  PROJECTS, MIME_COLORS, MIME_LABELS, buildGraph, generatePreview,
  fetchProjects, buildGraphFromBackend, searchFiles, fetchFilePreview,
});
