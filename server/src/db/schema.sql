CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'technician',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'created',
    technician_id TEXT REFERENCES technicians(id),
    client_ip TEXT,
    client_user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    claimed_at TEXT,
    connected_at TEXT,
    ended_at TEXT,
    end_reason TEXT,
    duration_seconds INTEGER,
    notes TEXT,
    tags TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id),
    timestamp TEXT DEFAULT (datetime('now')),
    actor TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    ip TEXT
);
