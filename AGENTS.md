# Project architecture rules

- Reuse the existing `INPILegalChatDialog` for every Fernanda legal-consultancy entry point, so AI behavior and integrations remain single-sourced.
- Gate legal-consultancy visibility with the existing `inpi_resources.can_view` permission, so Chat ao Vivo mirrors Recursos INPI access.
- Annuity campaigns run only server-side in the `annuity` edge function (self-chaining tick + hourly cron backstop), one row per client per exercise in `annuity_items`, so batches survive page closes and never duplicate charges.
