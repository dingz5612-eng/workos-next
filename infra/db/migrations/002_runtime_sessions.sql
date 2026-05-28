create table if not exists runtime_sessions (
    token text primary key,
    user_id text not null,
    issued_at_utc timestamptz not null,
    expires_at_utc timestamptz not null,
    body jsonb not null
);

create index if not exists ix_runtime_sessions_user on runtime_sessions(user_id, expires_at_utc);
