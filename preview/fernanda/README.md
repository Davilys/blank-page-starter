# Fernanda isolated preview

Preview-only migration root. Production deploy and automatic branching stay disabled. All database schedulers and production routes are removed. No Edge Functions are deployed.
Migration files contain server SQL only. psql meta-commands (line-leading `\`) are rejected by `verify-sanitized.sh`; fail-fast behavior is owned by the Supabase migration executor. CI also replays every file in filename order against an isolated PostgreSQL database.
