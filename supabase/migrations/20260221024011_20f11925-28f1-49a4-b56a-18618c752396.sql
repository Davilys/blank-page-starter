
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
VALUES (
  'Link de Assinatura',
  '[WebMarcas] {{documento_tipo}} pendente de assinatura - {{marca}}',
  '<div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1a1a2e; margin: 0;">WebMarcas</h2>
    <p style="color: #666; font-size: 14px;">Registro e Proteção de Marcas</p>
  </div>
  
  <p style="font-size: 16px; color: #333;">Olá <strong>{{nome}}</strong>,</p>
  
  <p style="font-size: 15px; color: #333; line-height: 1.6;">
    Você possui um documento pendente de assinatura eletrônica:
  </p>
  
  <div style="background: #f8f9fa; border-left: 4px solid #4f46e5; padding: 15px 20px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 15px;">📄 <strong>{{documento_tipo}}</strong>: {{marca}}</p>
  </div>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="{{link_assinatura}}" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
      ✍️ Assinar Documento
    </a>
  </div>
  
  <p style="font-size: 14px; color: #e74c3c; text-align: center;">
    ⚠️ Este link expira em <strong>{{data_expiracao}}</strong>.
  </p>
  
  <p style="font-size: 14px; color: #555; line-height: 1.6;">
    A assinatura eletrônica tem validade jurídica conforme Lei 14.063/2020 e será registrada em blockchain para garantir autenticidade.
  </p>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
  
  <p style="font-size: 13px; color: #888; text-align: center;">
    Dúvidas? Entre em contato:<br/>
    📞 (11) 4200-1656 | 📧 contato@webmarcas.com.br<br/>
    🌐 <a href="https://webmarcas.net" style="color: #4f46e5;">www.webmarcas.net</a>
  </p>
</div>',
  'signature_request',
  true
);
