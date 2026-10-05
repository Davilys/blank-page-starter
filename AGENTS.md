# Project architecture rules

- Reuse the existing `INPILegalChatDialog` for every Fernanda legal-consultancy entry point, so AI behavior and integrations remain single-sourced.
- Gate legal-consultancy visibility with the existing `inpi_resources.can_view` permission, so Chat ao Vivo mirrors Recursos INPI access.
