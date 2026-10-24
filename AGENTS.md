# Project architecture rules

- Reuse the existing `INPILegalChatDialog` for every Fernanda legal-consultancy entry point, so AI behavior and integrations remain single-sourced.
- Gate legal-consultancy visibility with the existing `inpi_resources.can_view` permission, so Chat ao Vivo mirrors Recursos INPI access.
- Annuity campaigns run only server-side in the `annuity` edge function (self-chaining tick + hourly cron backstop), one row per client per exercise in `annuity_items`, so batches survive page closes and never duplicate charges.
- Use `RegistrationTrustFooter` for registration trust badges and consent links, so registration pages keep consistent responsive alignment.
- Keep the preview dev server's dependency optimizer on an esbuild target that supports destructuring and top-level await (`optimizeDeps.esbuildOptions.target: "esnext"`), because esbuild 0.28 cannot lower destructuring for `safari14` and the dev server crash-loops on every reload.
