// ui.jsx
// Logo glyphs, search bar, settings popover, mini-map, preview panel,
// onboarding overlay, indexing overlay, error overlay.

// ─── Logo glyph variants ──────────────────────────────────────────────────
const LogoGlyph = ({ variant = 'cloud', size = 32 }) => {
  const gradId = `nb-grad-${variant}-${size}`;
  const grad = (
    <defs>
      <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"   stopColor="#f5a623" />
        <stop offset="38%"  stopColor="#e8524a" />
        <stop offset="70%"  stopColor="#4a90d9" />
        <stop offset="100%" stopColor="#7b52c0" />
      </linearGradient>
      <radialGradient id={gradId + '-r'} cx="50%" cy="50%" r="50%">
        <stop offset="0%"  stopColor="#f5a623" />
        <stop offset="40%" stopColor="#e8524a" />
        <stop offset="75%" stopColor="#4a90d9" />
        <stop offset="100%" stopColor="#7b52c0" />
      </radialGradient>
    </defs>
  );

  if (variant === 'cloud') {
    // Asymmetric soft nebula cloud — overlapping blobs being pulled to a gravity well
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
        {grad}
        <g style={{ filter: 'drop-shadow(0 0 6px rgba(232,82,74,0.45))' }}>
          <path
            d="M22 18 C 14 22 12 32 18 40 C 24 48 36 50 44 44 C 52 38 54 28 50 22 C 46 16 38 14 32 16 C 28 17 25 17 22 18 Z"
            fill={`url(#${gradId})`}
            opacity="0.92"
          />
          <ellipse cx="38" cy="30" rx="10" ry="7" fill={`url(#${gradId}-r)`} opacity="0.55" />
          <circle cx="44" cy="34" r="2.4" fill="#fff" opacity="0.9" />
          <circle cx="20" cy="24" r="1.2" fill="#fff" opacity="0.7" />
        </g>
      </svg>
    );
  }
  if (variant === 'rings') {
    // Concentric rings collapsing
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
        {grad}
        <g style={{ filter: 'drop-shadow(0 0 5px rgba(74,144,217,0.5))' }}>
          <ellipse cx="32" cy="32" rx="24" ry="8"  fill="none" stroke={`url(#${gradId})`} strokeWidth="1.2" opacity="0.5" transform="rotate(-18 32 32)"/>
          <ellipse cx="32" cy="32" rx="20" ry="6"  fill="none" stroke={`url(#${gradId})`} strokeWidth="1.4" opacity="0.7" transform="rotate(-18 32 32)"/>
          <ellipse cx="32" cy="32" rx="14" ry="4"  fill="none" stroke={`url(#${gradId})`} strokeWidth="1.6" opacity="0.9" transform="rotate(-18 32 32)"/>
          <circle cx="32" cy="32" r="3.2" fill={`url(#${gradId}-r)`} />
          <circle cx="32" cy="32" r="1.4" fill="#fff" />
        </g>
      </svg>
    );
  }
  // 'cluster' — implied shape from dots
  const dots = [
    [32,16,2.4],[26,20,1.4],[40,22,1.8],[20,28,1.6],[46,30,2.0],
    [24,38,1.4],[44,42,1.6],[32,46,2.6],[18,22,1.2],[50,38,1.4],
    [30,30,1.6],[36,36,1.4],[28,42,1.2],[42,18,1.2],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: 'block' }}>
      {grad}
      <g style={{ filter: 'drop-shadow(0 0 4px rgba(123,82,192,0.5))' }}>
        {dots.map(([x,y,r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill={`url(#${gradId})`} opacity={0.55 + (i%3)*0.15} />
        ))}
      </g>
    </svg>
  );
};

// ─── App header (logo + project name) ─────────────────────────────────────
// ─── App header (logo + project switcher) ─────────────────────────────────
const AppHeader = ({ projectKey, project, allProjects, onPickProject, logoVariant, onSwitchProject, surfaceLight, chatOpen, onChatToggle }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 16, left: 16, zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 8px 8px 10px',
      background: surfaceLight ? 'rgba(28,26,38,0.55)' : 'rgba(18,17,26,0.55)',
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      border: '0.5px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
    }}>
      <LogoGlyph variant={logoVariant} size={26} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, marginRight: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: '0.04em' }}>NEBULA</span>
        <span style={{ fontSize: 9.5, color: '#6e6a82', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Workspace
        </span>
      </div>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

      {/* Project switcher button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Switch folder"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '5px 8px 5px 9px',
          background: open ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
          color: '#e8e6f0',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2 3.5L1 4.5V10a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1H6L4.5 2H2.5A.5.5 0 002 2.5v1z"
                stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" opacity="0.7"/>
        </svg>
        <span style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono, ui-monospace, monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.55, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>
          <path d="M2 3.5L4.5 6 7 3.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* "Open another folder…" button — escape hatch back to onboarding */}
      <button
        onClick={onSwitchProject}
        title="Open another folder"
        style={{
          width: 26, height: 26, border: '0.5px solid rgba(255,255,255,0.08)',
          background: 'transparent', color: '#c8c4d8', borderRadius: 6,
          cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Chat toggle button */}
      <button
        onClick={onChatToggle}
        title={chatOpen ? 'Close chat' : 'Open chat'}
        style={{
          width: 26, height: 26,
          border: chatOpen ? '0.5px solid rgba(74,144,217,0.5)' : '0.5px solid rgba(255,255,255,0.08)',
          background: chatOpen ? 'rgba(74,144,217,0.15)' : 'transparent',
          color: chatOpen ? '#4a90d9' : '#c8c4d8', borderRadius: 6,
          cursor: 'pointer', padding: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
          <path d="M7 1C3.686 1 1 3.239 1 6c0 1.543.72 2.93 1.87 3.895L2.5 13l3.23-1.54A6.42 6.42 0 007 11c3.314 0 6-2.239 6-5s-2.686-5-6-5z"
                stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: 280,
          background: 'rgba(18,17,26,0.96)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: 5,
          boxShadow: '0 22px 56px rgba(0,0,0,0.6)',
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6e6a82', padding: '6px 10px 4px' }}>
            Recent folders
          </div>
          {Object.entries(allProjects).map(([key, p]) => {
            const active = key === projectKey;
            return (
              <button
                key={key}
                onClick={() => { onPickProject(key); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', textAlign: 'left',
                  padding: '7px 9px',
                  background: active ? 'rgba(74,144,217,0.12)' : 'transparent',
                  border: 0, borderRadius: 7,
                  cursor: 'pointer', color: '#e8e6f0', fontFamily: 'inherit',
                  marginBottom: 1,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: active ? 'rgba(74,144,217,0.25)' : 'rgba(255,255,255,0.05)',
                  border: '0.5px solid rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 3.5L1 4.5V10a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1H6L4.5 2H2.5A.5.5 0 002 2.5v1z"
                          stroke={active ? '#4a90d9' : '#c8c4d8'} strokeWidth="1" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, ui-monospace, monospace', color: active ? '#fff' : '#e8e6f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: '#6e6a82', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.description}
                  </div>
                </span>
                {active && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 5l2 2 4-5" stroke="#4a90d9" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            );
          })}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 4px' }} />
          <button
            onClick={() => { setOpen(false); onSwitchProject(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', textAlign: 'left',
              padding: '7px 9px',
              background: 'transparent', border: 0, borderRadius: 7,
              cursor: 'pointer', color: '#c8c4d8', fontFamily: 'inherit', fontSize: 11.5,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            Open another folder…
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Settings popover (gear icon + Gemini key field) ──────────────────────
const SettingsButton = ({ apiKey, onApiKeyChange, onReindex }) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(apiKey || '');
  React.useEffect(() => setDraft(apiKey || ''), [apiKey]);

  return (
    <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
      <button
        onClick={() => setOpen(!open)}
        title="Settings"
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(18,17,26,0.7)',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          color: '#c8c4d8', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 9.2A2.2 2.2 0 107 4.8a2.2 2.2 0 000 4.4z" stroke="currentColor" strokeWidth="0.9"/>
          <path d="M11.6 8.5l1 .6-1 1.7-1.1-.4a4.6 4.6 0 01-.95.55l-.2 1.15h-2l-.2-1.15a4.6 4.6 0 01-.95-.55l-1.1.4-1-1.7 1-.6a4.6 4.6 0 010-1.1l-1-.6 1-1.7 1.1.4a4.6 4.6 0 01.95-.55L7 1.5h2l.2 1.15c.34.14.66.32.95.55l1.1-.4 1 1.7-1 .6a4.6 4.6 0 010 1.1z"
                stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0, width: 320,
          background: 'rgba(18,17,26,0.92)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: 16,
          boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
          color: '#c8c4d8', fontSize: 12,
        }}>
          {/* spacecraft hatch detail */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 14, paddingBottom: 10,
            borderBottom: '0.5px solid #2e2a40',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: '#4a8c5c', boxShadow: '0 0 6px #4a8c5c' }} />
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#fff' }}>SETTINGS</span>
            </div>
            <span style={{ fontSize: 9, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace' }}>v0.4.1</span>
          </div>

          <label style={{ display: 'block', marginBottom: 6, fontSize: 10.5, fontWeight: 500,
                          letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6e6a82' }}>
            Gemini API key
          </label>
          <input
            type="password"
            value={draft === 'ENV_LOADED' ? '' : draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if (draft && draft !== 'ENV_LOADED') onApiKeyChange && onApiKeyChange(draft); }}
            placeholder={draft === 'ENV_LOADED' ? 'Loaded from .env ✓' : 'AIza…'}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: '#0a0a0f', border: '0.5px solid #2e2a40',
              borderRadius: 7, padding: '8px 10px',
              color: '#fff', fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
          <div style={{ marginTop: 6, fontSize: 10, color: '#6e6a82' }}>
            Stored locally · never leaves your machine
          </div>

          <button
            onClick={() => { onReindex && onReindex(); setOpen(false); }}
            style={{
              marginTop: 16, width: '100%', padding: '9px 14px',
              border: 0, borderRadius: 8,
              background: 'linear-gradient(90deg, #f5a623 0%, #e8524a 38%, #4a90d9 70%, #7b52c0 100%)',
              color: '#fff', fontWeight: 600, fontSize: 12, letterSpacing: '0.04em',
              cursor: 'pointer', boxShadow: '0 0 18px rgba(232,82,74,0.25)',
            }}
          >
            Re-index universe
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Search bar ───────────────────────────────────────────────────────────
const SUGGESTED_QUERIES = ['recent changes', 'configuration', 'documentation', 'tests', 'utilities', 'data models', 'scripts'];

// ─── Top-3 search results, shown above the SearchBar after a commit ──────
const TopResults = ({ results, mimeColors, onPick, onPickCluster }) => {
  if (!results || results.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, width: 'min(560px, 80vw)',
      background: 'rgba(18,17,26,0.94)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      border: '0.5px solid rgba(255,255,255,0.06)',
      borderRadius: 12,
      padding: 6,
      boxShadow: '0 22px 56px rgba(0,0,0,0.6)',
      animation: 'nebFadeIn 180ms ease-out',
    }}>
      <style>{`@keyframes nebFadeIn { from { opacity: 0; transform: translate(-50%, 4px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 6px' }}>
        <span style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6e6a82' }}>
          Top {results.length} match{results.length !== 1 ? 'es' : ''}
        </span>
      </div>
      {results.map(({ node, score }, i) => {
        const c = mimeColors[node.mime] || '#c8c4d8';
        return (
          <button key={node.id}
            onClick={() => onPick && onPick(node)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', textAlign: 'left',
              padding: '8px 10px',
              background: 'transparent', border: 0, borderRadius: 8,
              cursor: 'pointer', color: '#e8e6f0', fontFamily: 'inherit',
              marginBottom: 1,
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: c, opacity: 0.85,
              boxShadow: `0 0 14px ${c}88`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9.5, fontWeight: 700, color: 'rgba(0,0,0,0.7)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontFamily: 'JetBrains Mono, ui-monospace, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
              </div>
              <div style={{ fontSize: 10, color: '#6e6a82', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.path}
              </div>
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onPickCluster && onPickCluster(node.cluster); }}
              title={`Frame the ${node.cluster} cluster`}
              style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 999,
                color: '#c8c4d8',
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                cursor: 'pointer',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
            >
              {node.cluster}
            </button>
          </button>
        );
      })}
    </div>
  );
};

const SearchBar = ({ value, onChange, onSubmit, suggestionsOpen, onFocus, onBlur, suggestions, onPickSuggestion, onClear, committedQuery, matches }) => {
  const isDirty = value !== committedQuery;
  return (
    <div style={{
      position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 10, width: 'min(560px, 80vw)',
    }}>
      {suggestionsOpen && suggestions.length > 0 && (
        <div style={{
          marginBottom: 8, padding: 10,
          background: 'rgba(18,17,26,0.92)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '0.5px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6e6a82', marginBottom: 8, paddingLeft: 4 }}>
            Try
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map(s => (
              <button key={s} onMouseDown={(e) => { e.preventDefault(); onPickSuggestion(s); }}
                style={{
                  padding: '5px 10px', fontSize: 11.5,
                  background: '#221f30', color: '#c8c4d8',
                  border: '0.5px solid #2e2a40', borderRadius: 999,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 999,
          padding: 1,
          background: committedQuery
            ? 'linear-gradient(90deg, #f5a623 0%, #e8524a 38%, #4a90d9 70%, #7b52c0 100%)'
            : 'linear-gradient(90deg, rgba(245,166,35,0.4), rgba(232,82,74,0.4), rgba(74,144,217,0.4), rgba(123,82,192,0.4))',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMaskComposite: 'xor', maskComposite: 'exclude',
          pointerEvents: 'none',
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 18px',
          background: 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: 999,
          boxShadow: '0 18px 48px rgba(0,0,0,0.5)',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
            <circle cx="6" cy="6" r="4" stroke="#c8c4d8" strokeWidth="1"/>
            <path d="M9 9l3 3" stroke="#c8c4d8" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit(value);
              else if (e.key === 'Escape') onClear && onClear();
            }}
            placeholder="Search your universe… (press Enter)"
            style={{
              flex: 1, border: 0, background: 'transparent',
              color: '#fff', fontSize: 13, outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {value && (
            <button
              onMouseDown={(e) => { e.preventDefault(); onClear && onClear(); }}
              style={{
                width: 18, height: 18, padding: 0, borderRadius: 9,
                background: 'rgba(255,255,255,0.08)', border: 0,
                color: '#c8c4d8', fontSize: 10, cursor: 'pointer', flexShrink: 0,
              }}
            >✕</button>
          )}
          {isDirty && value.trim() && (
            <span style={{
              fontSize: 9.5, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 7px', background: 'rgba(255,255,255,0.04)', borderRadius: 999,
              border: '0.5px solid #2e2a40',
            }}>
              ↵ to search
            </span>
          )}
          {!isDirty && committedQuery && (
            <span style={{
              fontSize: 10, color: matches > 0 ? '#4a90d9' : '#c0504a',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '2px 7px',
              background: matches > 0 ? 'rgba(74,144,217,0.12)' : 'rgba(192,80,74,0.12)',
              borderRadius: 999,
            }}>
              {matches} match{matches !== 1 ? 'es' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Tooltip on hover ─────────────────────────────────────────────────────
const HoverTooltip = ({ node, screen }) => {
  if (!node || !screen) return null;
  const color = window.MIME_COLORS[node.mime];
  return (
    <div style={{
      position: 'fixed', left: screen.x + 14, top: screen.y + 14,
      pointerEvents: 'none', zIndex: 30,
      background: 'rgba(18,17,26,0.95)',
      backdropFilter: 'blur(12px)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: '7px 10px',
      fontSize: 11.5, color: '#fff',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      maxWidth: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 7, height: 7, borderRadius: 3.5, background: color,
          boxShadow: `0 0 6px ${color}`,
        }} />
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>{node.name}</span>
      </div>
      <div style={{ marginTop: 4, fontSize: 10, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace' }}>
        {node.path}
      </div>
    </div>
  );
};

// ─── Mini-map ──────────────────────────────────────────────────────────────
const MiniMap = ({ graph, camPos, selectedId, pulseIds }) => {
  const size = 140;
  const scale = size / 200; // graph spans roughly -90..90
  const project = (x, y) => [size/2 + x * scale, size/2 + y * scale];

  return (
    <div style={{
      position: 'absolute', bottom: 24, right: 24, zIndex: 10,
      width: size, height: size,
      background: 'rgba(18,17,26,0.78)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 8,
    }}>
      <svg width={size - 16} height={size - 16} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        {graph && graph.nodes.map(n => {
          const [px, py] = project(n.x, n.z); // top-down view (xz plane)
          const c = window.MIME_COLORS[n.mime];
          const isPulse = pulseIds && pulseIds.has(n.id);
          const isSel = selectedId === n.id;
          return (
            <circle key={n.id} cx={px} cy={py}
              r={isSel || isPulse ? 2.2 : 1}
              fill={c} opacity={isSel || isPulse ? 1 : 0.55}
            />
          );
        })}
        {/* camera frustum indicator */}
        {camPos && (() => {
          const [cx, cy] = project(camPos.x, camPos.z);
          return (
            <g>
              <circle cx={cx} cy={cy} r="3" fill="none" stroke="#4a90d9" strokeWidth="1" />
              <circle cx={cx} cy={cy} r="1.2" fill="#4a90d9" />
            </g>
          );
        })()}
      </svg>
      <div style={{
        position: 'absolute', top: 8, left: 12,
        fontSize: 9, color: '#6e6a82',
        fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em',
      }}>
        OVERVIEW
      </div>
    </div>
  );
};

// ─── Preview panel ─────────────────────────────────────────────────────────
const PreviewPanel = ({ node, graph, onClose, onPickNeighbor, surfaceLight }) => {
  if (!node) return null;
  const color = window.MIME_COLORS[node.mime];
  const label = window.MIME_LABELS[node.mime];

  // Find 5 nearest neighbors by edge weight (or fallback to cluster)
  const neighbors = React.useMemo(() => {
    if (!graph) return [];
    const scored = new Map();
    graph.edges.forEach(e => {
      if (e.a === node.id) {
        const cur = scored.get(e.b) || 0;
        scored.set(e.b, Math.max(cur, e.similarity));
      } else if (e.b === node.id) {
        const cur = scored.get(e.a) || 0;
        scored.set(e.a, Math.max(cur, e.similarity));
      }
    });
    graph.nodes.forEach(n => {
      if (n.id !== node.id && n.cluster === node.cluster && !scored.has(n.id)) {
        scored.set(n.id, 0.6);
      }
    });
    const arr = [...scored.entries()]
      .map(([id, sim]) => ({ node: graph.nodes[id], sim }))
      .filter(x => x.node)
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 5);
    return arr;
  }, [node, graph]);

  // preview is a structured object: { kind, content, mime, name, path, size, message }
  const [preview, setPreview] = React.useState({ kind: 'loading' });
  React.useEffect(() => {
    setPreview({ kind: 'loading' });
    if (window.fetchFilePreview) {
      window.fetchFilePreview(node.path)
        .then(d => setPreview(d || { kind: 'error', message: 'No preview' }))
        .catch(e => setPreview({ kind: 'error', message: String(e) }));
    } else {
      setPreview({ kind: 'error', message: 'Preview API unavailable' });
    }
  }, [node]);

  const handleOpenInApp = React.useCallback(() => {
    if (window.openInDefaultApp) window.openInDefaultApp(node.path);
  }, [node]);

  const surfaceBg = surfaceLight ? '#22202e' : '#1a1826';
  const innerBg = surfaceLight ? '#19171f' : '#12111a';

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(440px, 42vw)',
      zIndex: 20,
      background: surfaceBg,
      borderLeft: '1px solid transparent',
      borderImage: 'linear-gradient(180deg, #f5a623, #e8524a, #4a90d9, #7b52c0) 1',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)',
      boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
    }}>
      <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      {/* Header */}
      <div style={{
        padding: '18px 20px 14px', borderBottom: '0.5px solid #2e2a40',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{
              fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
              padding: '2px 7px', borderRadius: 4,
              background: color, color: '#0a0a0f',
            }}>
              {label}
            </span>
            <span style={{ fontSize: 10.5, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace' }}>
              {node.cluster}
            </span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', wordBreak: 'break-word' }}>
            {node.name}
          </div>
          <div style={{ fontSize: 11, color: '#6e6a82', marginTop: 4, fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>
            {node.path}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button onClick={onClose} title="Close" style={{
            width: 26, height: 26, borderRadius: 6, padding: 0,
            background: 'transparent', border: '0.5px solid #2e2a40',
            color: '#c8c4d8', cursor: 'pointer', fontSize: 13,
          }}>✕</button>
          <button onClick={handleOpenInApp} title="Open in default app" style={{
            width: 26, height: 26, borderRadius: 6, padding: 0,
            background: 'transparent', border: '0.5px solid #2e2a40',
            color: '#c8c4d8', cursor: 'pointer', fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(74,144,217,0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M5 2H2.5A.5.5 0 002 2.5V11.5A.5.5 0 002.5 12H11.5A.5.5 0 0012 11.5V9M8 2h4v4M12 2L6 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Metadata strip */}
      <div style={{
        padding: '10px 20px', display: 'flex', gap: 18, alignItems: 'center',
        fontSize: 10.5, color: '#6e6a82',
        fontFamily: 'JetBrains Mono, monospace',
        borderBottom: '0.5px solid #2e2a40',
      }}>
        {preview.size != null && (
          <div><span style={{ color: '#c8c4d8' }}>{(preview.size / 1024).toFixed(1)}</span> KB</div>
        )}
        <div style={{ color: '#6e6a82' }}>{preview.kind === 'loading' ? '…' : preview.kind}</div>
        <button onClick={handleOpenInApp} style={{
          marginLeft: 'auto', fontSize: 10.5, color: '#4a90d9',
          background: 'transparent', border: 0, padding: 0, cursor: 'pointer',
          fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3,
        }}>Open in default app</button>
      </div>

      {/* Body — text / image / pdf / binary / error */}
      <PreviewBody preview={preview} innerBg={innerBg} />

      {/* Nearest neighbors */}
      <div style={{
        padding: '14px 20px 18px', borderTop: '0.5px solid #2e2a40',
        background: surfaceBg, maxHeight: 220, overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: '#6e6a82', marginBottom: 10,
        }}>
          Nearest neighbors
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {neighbors.map(({ node: n, sim }) => {
            const nc = window.MIME_COLORS[n.mime];
            return (
              <button key={n.id} onClick={() => onPickNeighbor(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 8px', borderRadius: 6,
                  background: 'transparent', border: 0, width: '100%',
                  color: '#c8c4d8', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'inherit', fontSize: 11.5,
                  transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#221f30'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: 4, background: nc, flexShrink: 0,
                  boxShadow: `0 0 6px ${nc}`,
                }} />
                <span style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace',
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.name}
                </span>
                <span style={{ fontSize: 10, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace' }}>
                  {sim.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Onboarding overlay (drop a folder) ───────────────────────────────────
const OnboardingOverlay = ({ logoVariant, onDropFolder, apiKeySet }) => {
  const [dragOver, setDragOver] = React.useState(false);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 28,
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ animation: 'logoFloat 4s ease-in-out infinite' }}>
        <LogoGlyph variant={logoVariant} size={88} />
      </div>
      <style>{`@keyframes logoFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`}</style>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDropFolder(); }}
        onClick={onDropFolder}
        style={{
          position: 'relative',
          width: 380, padding: '40px 32px',
          borderRadius: 14,
          textAlign: 'center', cursor: 'pointer',
          background: dragOver ? 'rgba(74,144,217,0.06)' : 'transparent',
          transition: 'background 0.2s',
        }}
      >
        {/* SVG dashed gradient border — border-image doesn't honor `dashed`, so paint it ourselves */}
        <svg
          width="100%" height="100%"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            <linearGradient id="dropBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="#f5a623" stopOpacity={dragOver ? 1 : 0.6} />
              <stop offset="38%"  stopColor="#e8524a" stopOpacity={dragOver ? 1 : 0.6} />
              <stop offset="70%"  stopColor="#4a90d9" stopOpacity={dragOver ? 1 : 0.6} />
              <stop offset="100%" stopColor="#7b52c0" stopOpacity={dragOver ? 1 : 0.6} />
            </linearGradient>
          </defs>
          <rect
            x="1" y="1"
            width="calc(100% - 2px)" height="calc(100% - 2px)"
            rx="13" ry="13"
            fill="none"
            stroke="url(#dropBorderGrad)"
            strokeWidth="1.5"
            strokeDasharray="7 5"
          />
        </svg>
        <div style={{ position: 'relative', fontSize: 16, color: '#fff', fontWeight: 500, marginBottom: 4 }}>
          Drop a folder
        </div>
        <div style={{ position: 'relative', fontSize: 13, color: '#c8c4d8' }}>
          to map your universe
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6e6a82' }}>
        Requires a Gemini API key
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: apiKeySet ? '#4a8c5c' : '#c0504a',
          boxShadow: `0 0 5px ${apiKeySet ? '#4a8c5c' : '#c0504a'}`,
        }} />
        <span>· ⚙</span>
      </div>
    </div>
  );
};

// ─── Indexing overlay (galaxy birth) ──────────────────────────────────────
const IndexingOverlay = ({ progress, fileCount, currentFile }) => {
  return (
    <>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 12,
        textAlign: 'center', pointerEvents: 'none',
        opacity: progress < 0.95 ? 1 : 0,
        transition: 'opacity 0.4s',
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: '#6e6a82', marginBottom: 8,
        }}>
          Indexing
        </div>
        <div style={{
          fontSize: 13, color: '#c8c4d8',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {Math.round(progress * fileCount)} / {fileCount}
        </div>
        {currentFile && (
          <div style={{
            marginTop: 4, fontSize: 10.5, color: '#6e6a82',
            fontFamily: 'JetBrains Mono, monospace',
            maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {currentFile}
          </div>
        )}
      </div>
      {/* Bottom progress bar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: 2,
        background: 'rgba(46,42,64,0.4)', zIndex: 12,
        opacity: progress < 0.99 ? 1 : 0,
        transition: 'opacity 0.6s',
      }}>
        <div style={{
          height: '100%', width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, #f5a623 0%, #e8524a 38%, #4a90d9 70%, #7b52c0 100%)',
          boxShadow: '0 0 8px rgba(74,144,217,0.6)',
          transition: 'width 0.3s linear',
        }} />
      </div>
    </>
  );
};

// ─── Error overlay ────────────────────────────────────────────────────────
const ErrorOverlay = ({ message, onRetry, onDismiss }) => {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,10,15,0.85)',
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: 420, padding: 24,
        background: '#12111a',
        border: '0.5px solid #2e2a40',
        borderTop: '2px solid #c0504a',
        borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 4,
            background: '#c0504a', boxShadow: '0 0 8px #c0504a',
            animation: 'errBlink 1.4s ease-in-out infinite',
          }} />
          <style>{`@keyframes errBlink { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
          <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em', color: '#c0504a', textTransform: 'uppercase' }}>
            Indexing failed
          </span>
        </div>
        <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.45, marginBottom: 6 }}>
          {message || 'Could not reach the embeddings service.'}
        </div>
        <div style={{ fontSize: 11.5, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace', marginBottom: 18 }}>
          gemini.api · ECONNRESET · attempt 3/3
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onRetry} style={{
            flex: 1, padding: '9px 14px', border: 0, borderRadius: 8,
            background: 'linear-gradient(90deg, #f5a623, #e8524a, #4a90d9, #7b52c0)',
            color: '#fff', fontWeight: 600, fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Retry
          </button>
          <button onClick={onDismiss} style={{
            padding: '9px 14px', border: '0.5px solid #2e2a40', borderRadius: 8,
            background: 'transparent', color: '#c8c4d8', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit',
          }}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Preview body — branches on preview.kind (text, image, pdf, binary, error) ──
const PreviewBody = ({ preview, innerBg }) => {
  const kind = preview?.kind;

  if (kind === 'loading') {
    return (
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: innerBg, color: '#6e6a82', fontSize: 12,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        Loading preview…
      </div>
    );
  }

  if (kind === 'image' && preview.content) {
    const src = `data:${preview.mime || 'image/png'};base64,${preview.content}`;
    return (
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        background: innerBg, padding: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src={src}
          alt={preview.name || 'image preview'}
          style={{
            maxWidth: '100%', maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 6,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    );
  }

  if (kind === 'pdf' && preview.content) {
    const src = `data:application/pdf;base64,${preview.content}`;
    return (
      <div style={{
        flex: 1, minHeight: 0,
        background: innerBg, position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        <object
          data={src}
          type="application/pdf"
          style={{ width: '100%', flex: 1, border: 0 }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
            color: '#6e6a82', fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
          }}>
            <div style={{ fontSize: 28, opacity: 0.4 }}>📄</div>
            <div style={{ color: '#c8c4d8' }}>{preview.name || 'PDF'}</div>
            <div style={{ fontSize: 10.5 }}>
              In-app PDF preview not supported by this WebView.
              <br />Use “Open in default app” above.
            </div>
          </div>
        </object>
      </div>
    );
  }

  if (kind === 'binary' || kind === 'error') {
    return (
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
        background: innerBg, color: '#6e6a82', fontSize: 12,
        fontFamily: 'JetBrains Mono, monospace', padding: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 28, opacity: 0.4 }}>
          {kind === 'binary' ? '⬚' : '⚠'}
        </div>
        <div style={{ color: '#c8c4d8' }}>
          {kind === 'binary' ? 'Binary file' : 'Preview unavailable'}
        </div>
        <div style={{ fontSize: 10.5, maxWidth: 320 }}>
          {preview.message || 'No preview available for this file.'}
        </div>
      </div>
    );
  }

  // Text fallback (kind === 'text' or anything else with content)
  const textContent = (kind === 'text' && preview.content) ? preview.content : (preview?.message || '(no preview available)');
  return <ScrollableFileBody preview={textContent} innerBg={innerBg} />;
};

// ─── Scrollable file body with in-file find ──────────────────────────────
const ScrollableFileBody = ({ preview, innerBg }) => {
  const [findOpen, setFindOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [activeIdx, setActiveIdx] = React.useState(0);
  const scrollRef = React.useRef(null);
  const findInputRef = React.useRef(null);
  const lines = React.useMemo(() => preview.split('\n'), [preview]);

  // Compute matches: array of {line, start, end}
  const matches = React.useMemo(() => {
    if (!query.trim()) return [];
    const out = [];
    const q = query.toLowerCase();
    lines.forEach((line, li) => {
      const lower = line.toLowerCase();
      let from = 0;
      while (true) {
        const at = lower.indexOf(q, from);
        if (at === -1) break;
        out.push({ line: li, start: at, end: at + q.length });
        from = at + Math.max(1, q.length);
      }
    });
    return out;
  }, [query, lines]);

  React.useEffect(() => {
    if (matches.length === 0) { setActiveIdx(0); return; }
    setActiveIdx(i => Math.min(i, matches.length - 1));
  }, [matches.length]);

  // Scroll active match into view
  React.useEffect(() => {
    if (matches.length === 0) return;
    const m = matches[activeIdx];
    if (!m) return;
    const lineEl = scrollRef.current?.querySelector(`[data-line="${m.line}"]`);
    if (lineEl) {
      const sc = scrollRef.current;
      const top = lineEl.offsetTop - sc.clientHeight / 2 + lineEl.clientHeight / 2;
      sc.scrollTo({ top, behavior: 'smooth' });
    }
  }, [activeIdx, matches]);

  // Keyboard: Cmd/Ctrl+F to open, Esc to close, Enter to next, Shift+Enter prev
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 30);
      } else if (e.key === 'Escape' && findOpen) {
        setFindOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [findOpen]);

  const renderLine = (line, li) => {
    // Find matches inside this line, render highlighted
    const lineMatches = matches.filter(m => m.line === li);
    if (lineMatches.length === 0) return line || ' ';
    const out = [];
    let cursor = 0;
    lineMatches.forEach((m, mi) => {
      if (m.start > cursor) out.push(line.slice(cursor, m.start));
      const globalIdx = matches.indexOf(m);
      const isActive = globalIdx === activeIdx;
      out.push(
        <mark key={mi} style={{
          background: isActive ? '#f5a623' : 'rgba(74,144,217,0.45)',
          color: isActive ? '#0a0a0f' : '#fff',
          borderRadius: 2, padding: '0 1px',
        }}>{line.slice(m.start, m.end)}</mark>
      );
      cursor = m.end;
    });
    if (cursor < line.length) out.push(line.slice(cursor));
    return out;
  };

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Find toolbar (above scroll body) */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px 6px 18px',
        borderBottom: '0.5px solid #2e2a40',
        background: innerBg,
        height: findOpen ? 36 : 30, transition: 'height 0.15s',
      }}>
        {!findOpen ? (
          <button onClick={() => { setFindOpen(true); setTimeout(() => findInputRef.current?.focus(), 20); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 9px', borderRadius: 6,
              background: 'transparent', border: '0.5px solid #2e2a40',
              color: '#6e6a82', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 10.5,
            }}>
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1"/>
              <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            Find in file
            <span style={{
              fontSize: 9, padding: '1px 5px', borderRadius: 3,
              background: '#221f30', color: '#6e6a82',
              fontFamily: 'JetBrains Mono, monospace', marginLeft: 2,
            }}>⌘F</span>
          </button>
        ) : (
          <>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.6 }}>
              <circle cx="6" cy="6" r="4" stroke="#c8c4d8" strokeWidth="1"/>
              <path d="M9 9l3 3" stroke="#c8c4d8" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <input
              ref={findInputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (matches.length === 0) return;
                  setActiveIdx(i => e.shiftKey
                    ? (i - 1 + matches.length) % matches.length
                    : (i + 1) % matches.length);
                }
              }}
              placeholder="Find in file"
              style={{
                flex: 1, minWidth: 0, height: 22,
                background: '#0a0a0f', border: '0.5px solid #2e2a40',
                borderRadius: 5, padding: '0 8px',
                color: '#fff', fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                outline: 'none',
              }}
            />
            <span style={{
              fontSize: 10, color: matches.length ? '#c8c4d8' : '#6e6a82',
              fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
            }}>
              {matches.length === 0
                ? (query ? '0/0' : '—')
                : `${activeIdx + 1}/${matches.length}`}
            </span>
            <button
              disabled={matches.length === 0}
              onClick={() => setActiveIdx(i => (i - 1 + matches.length) % matches.length)}
              style={{
                width: 20, height: 20, padding: 0, borderRadius: 4,
                background: 'transparent', border: '0.5px solid #2e2a40',
                color: matches.length ? '#c8c4d8' : '#3e3a50', cursor: matches.length ? 'pointer' : 'default',
                fontSize: 10,
              }}>↑</button>
            <button
              disabled={matches.length === 0}
              onClick={() => setActiveIdx(i => (i + 1) % matches.length)}
              style={{
                width: 20, height: 20, padding: 0, borderRadius: 4,
                background: 'transparent', border: '0.5px solid #2e2a40',
                color: matches.length ? '#c8c4d8' : '#3e3a50', cursor: matches.length ? 'pointer' : 'default',
                fontSize: 10,
              }}>↓</button>
            <button
              onClick={() => { setFindOpen(false); setQuery(''); }}
              style={{
                width: 20, height: 20, padding: 0, borderRadius: 4,
                background: 'transparent', border: '0.5px solid #2e2a40',
                color: '#c8c4d8', cursor: 'pointer', fontSize: 11,
              }}>✕</button>
          </>
        )}
      </div>

      {/* Scrollable code body with line numbers */}
      <div ref={scrollRef} style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        background: innerBg,
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        fontSize: 11.5, lineHeight: 1.6,
        color: '#c8c4d8',
      }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {lines.map((line, li) => (
              <tr key={li} data-line={li} style={{ verticalAlign: 'top' }}>
                <td style={{
                  width: 38, padding: '0 10px 0 14px',
                  textAlign: 'right',
                  color: '#3e3a50',
                  userSelect: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  borderRight: '0.5px solid #221f30',
                }}>{li + 1}</td>
                <td style={{
                  padding: '0 16px 0 12px',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{renderLine(line, li)}</td>
              </tr>
            ))}
            <tr><td colSpan={2} style={{ height: 24 }} /></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Chat panel (slide-in drawer from right) ──────────────────────────────
const ChatPanel = ({ open, onClose, projectRoot, surfaceLight, onAgentResult, onAgentFsChange }) => {
  const [messages, setMessages] = React.useState([
    { role: 'agent', text: 'Ask me anything about your codebase — files, architecture, code patterns.' }
  ]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sessionId, setSessionId] = React.useState(null);
  const logRef = React.useRef(null);

  // Reset session + clear messages whenever the active project changes.
  React.useEffect(() => {
    setSessionId(null);
    setMessages([
      { role: 'agent', text: 'Ask me anything about your codebase — files, architecture, code patterns.' }
    ]);
    setInput('');
  }, [projectRoot]);

  const ensureSession = React.useCallback(async () => {
    if (sessionId) return sessionId;
    try {
      const r = await fetch('http://127.0.0.1:8765/api/session/new', { method: 'POST' });
      const d = await r.json();
      setSessionId(d.session_id);
      return d.session_id;
    } catch { return 'fallback-' + Date.now(); }
  }, [sessionId]);

  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = React.useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const sid = await ensureSession();
      const r = await fetch('http://127.0.0.1:8765/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid, message: text, project_id: projectRoot || '' }),
      });
      const d = await r.json();
      const reply = d.reply || '(no response)';
      const hits = d.found_files || [];
      const tools = d.tools_used || [];
      setMessages(m => [...m, { role: 'agent', text: reply, hits }]);

      // Surface the top file to the parent so it can populate the search bar
      if (hits.length > 0 && onAgentResult) {
        onAgentResult({ query: text, hits });
      }
      // If the agent ran a destructive / mutating tool (executed plan, trash),
      // tell the parent to refresh the visualization.
      const FS_TOOLS = new Set(['execute_plan', 'trash_file']);
      if (tools.some(t => FS_TOOLS.has(t)) && onAgentFsChange) {
        onAgentFsChange();
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'error', text: 'Connection error: ' + e.message }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, ensureSession, projectRoot, onAgentResult, onAgentFsChange]);

  const surfaceBg = surfaceLight ? '#22202e' : '#1a1826';
  const innerBg = surfaceLight ? '#19171f' : '#12111a';

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(360px, 38vw)',
      zIndex: 25,
      background: surfaceBg,
      borderLeft: '1px solid transparent',
      borderImage: 'linear-gradient(180deg, #4a90d9, #7b52c0) 1',
      display: 'flex', flexDirection: 'column',
      animation: 'slideInRight 0.28s cubic-bezier(0.2,0.8,0.2,1)',
      boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', borderBottom: '0.5px solid #2e2a40',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1C3.686 1 1 3.239 1 6c0 1.543.72 2.93 1.87 3.895L2.5 13l3.23-1.54A6.42 6.42 0 007 11c3.314 0 6-2.239 6-5s-2.686-5-6-5z"
                  stroke="#4a90d9" strokeWidth="1" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', letterSpacing: '0.04em' }}>Agent Chat</span>
        </div>
        <button onClick={onClose} style={{
          width: 24, height: 24, borderRadius: 5, padding: 0,
          background: 'transparent', border: '0.5px solid #2e2a40',
          color: '#c8c4d8', cursor: 'pointer', fontSize: 12,
        }}>✕</button>
      </div>

      {/* Message log */}
      <div ref={logRef} style={{
        flex: 1, overflowY: 'auto', padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '88%', padding: '9px 12px', borderRadius: 8,
              fontSize: 12.5, lineHeight: 1.55,
              background: msg.role === 'user' ? 'rgba(74,144,217,0.18)' : (msg.role === 'error' ? 'rgba(232,82,74,0.12)' : innerBg),
              border: msg.role === 'user' ? '0.5px solid rgba(74,144,217,0.3)' : (msg.role === 'error' ? '0.5px solid rgba(232,82,74,0.3)' : '0.5px solid #2e2a40'),
              color: msg.role === 'error' ? '#e8524a' : '#c8c4d8',
              fontFamily: 'inherit',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.text}
            </div>
            {msg.hits && msg.hits.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: '88%' }}>
                {msg.hits.slice(0, 5).map((h, hi) => {
                  const mimeColor = window.MIME_COLORS[h.file_type] || '#8a5cc0';
                  return (
                    <span key={hi} style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 4,
                      background: `${mimeColor}20`, border: `0.5px solid ${mimeColor}50`,
                      color: mimeColor, fontFamily: 'JetBrains Mono, monospace',
                      cursor: 'default',
                    }} title={h.filepath}>
                      {h.filename}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a90d9', animation: 'pulse 1s ease-in-out infinite' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a90d9', animation: 'pulse 1s ease-in-out infinite 0.2s' }} />
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4a90d9', animation: 'pulse 1s ease-in-out infinite 0.4s' }} />
            <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 14px', borderTop: '0.5px solid #2e2a40',
        display: 'flex', gap: 8, alignItems: 'flex-end',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Ask about your codebase…"
          rows={2}
          style={{
            flex: 1, background: innerBg, border: '0.5px solid #2e2a40',
            borderRadius: 7, padding: '8px 10px',
            color: '#c8c4d8', fontFamily: 'inherit', fontSize: 12.5,
            resize: 'none', outline: 'none', lineHeight: 1.5,
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(74,144,217,0.4)'}
          onBlur={e => e.target.style.borderColor = '#2e2a40'}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            width: 32, height: 32, borderRadius: 7, padding: 0,
            background: input.trim() && !loading ? '#4a90d9' : 'rgba(74,144,217,0.2)',
            border: 0, cursor: input.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s', flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

// ─── Pipeline bar (SSE indexing visualizer, fixed at bottom) ─────────────────
const PipelineBar = ({ state, visible }) => {
  const STAGES = [
    { key: 'loaded', label: 'loaded',       color: '#3b82f6' },
    { key: 'embed',  label: 'gemini-embed', color: '#f59e0b' },
    { key: 'insert', label: 'atlas-insert', color: '#8b5cf6' },
    { key: 'done',   label: 'done',         color: '#10b981' },
  ];
  const total  = Math.max(state.total, 1);
  const errors = state.stages.error || 0;

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, height: 66, zIndex: 11,
      background: 'rgba(10,10,15,0.93)',
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      borderTop: '0.5px solid rgba(255,255,255,0.06)',
      padding: '8px 20px 6px',
      display: 'flex', flexDirection: 'column', gap: 5,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(100%)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {/* Stage bars */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
        {STAGES.map((s, i) => {
          const n = state.stages[s.key] || 0;
          const ratio = Math.min(1, n / total);
          return (
            <React.Fragment key={s.key}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9, color: '#6e6a82', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 9, color: n > 0 ? s.color : '#3e3a50', fontFamily: 'JetBrains Mono, monospace' }}>
                    {n}/{state.total || 0}
                  </span>
                </div>
                <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${ratio * 100}%`,
                    background: s.color,
                    boxShadow: `0 0 5px ${s.color}88`,
                    borderRadius: 3,
                    transition: 'width 0.25s ease',
                  }} />
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{ color: '#2e2a40', fontSize: 11, alignSelf: 'center', paddingBottom: 6, flexShrink: 0 }}>›</div>
              )}
            </React.Fragment>
          );
        })}
        {errors > 0 && (
          <div style={{ alignSelf: 'center', paddingBottom: 6, marginLeft: 6, fontSize: 10, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
            ✗ {errors}
          </div>
        )}
      </div>
      {/* Recent file ticker */}
      <div style={{
        fontSize: 9.5, color: '#4a6a50', fontFamily: 'JetBrains Mono, monospace',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        paddingLeft: 1,
      }}>
        {state.recent.length > 0 ? `▸ ${state.recent[state.recent.length - 1]}` : ' '}
      </div>
    </div>
  );
};

Object.assign(window, {
  LogoGlyph, AppHeader, SettingsButton, SearchBar, TopResults, HoverTooltip,
  MiniMap, PreviewPanel, OnboardingOverlay, IndexingOverlay, ErrorOverlay,
  SUGGESTED_QUERIES, ScrollableFileBody, ChatPanel, PipelineBar,
});
