-- Insert default email templates if they don't exist

-- 1. Email de Boas-Vindas (form_started)
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Boas-Vindas',
  'Bem-vindo à WebMarcas, {{nome}}! 🎉',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a365d 0%, #2d5a87 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #2d5a87; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Bem-vindo à WebMarcas!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Ficamos muito felizes em receber seu interesse em proteger sua marca!</p>
      <p>Recebemos suas informações e nossa equipe já está analisando seu caso. Em breve entraremos em contato para dar continuidade ao processo de registro da sua marca.</p>
      <h3>Próximos Passos:</h3>
      <ul>
        <li>Análise de viabilidade da sua marca</li>
        <li>Preparação da documentação necessária</li>
        <li>Acompanhamento do processo junto ao INPI</li>
      </ul>
      <p>Caso tenha alguma dúvida, não hesite em nos contatar!</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'form_started',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'form_started'
);

-- 2. Email de Follow-up 24h (form_abandoned)
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Follow-up 24h',
  '{{nome}}, sua marca ainda está disponível! ⏰',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #d97706; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .highlight { background: #fef3c7; padding: 15px; border-radius: 5px; border-left: 4px solid #d97706; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⏰ Não deixe para depois!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Notamos que você iniciou o processo de registro da sua marca, mas ainda não concluiu o cadastro.</p>
      <div class="highlight">
        <strong>⚠️ Importante:</strong> Enquanto sua marca não está registrada, outra pessoa pode registrá-la antes de você!
      </div>
      <p>O processo é simples e rápido. Leva apenas alguns minutos para proteger o que é seu.</p>
      <p style="text-align: center;">
        <a href="{{link_area_cliente}}" class="button">Continuar Cadastro</a>
      </p>
      <p>Se precisar de ajuda ou tiver alguma dúvida, nossa equipe está à disposição!</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'form_abandoned',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'form_abandoned'
);

-- 3. Confirmação de Contrato (contract_signed)
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Confirmação de Contrato',
  'Contrato Assinado com Sucesso - {{marca}} ✅',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #059669; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .info-box { background: #d1fae5; padding: 15px; border-radius: 5px; border-left: 4px solid #059669; margin: 20px 0; }
    .hash { font-family: monospace; background: #e5e7eb; padding: 10px; border-radius: 5px; word-break: break-all; font-size: 12px; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Contrato Assinado!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Confirmamos que seu contrato para registro da marca <strong>{{marca}}</strong> foi assinado com sucesso!</p>
      <div class="info-box">
        <strong>📋 Detalhes do Contrato:</strong>
        <ul>
          <li><strong>Marca:</strong> {{marca}}</li>
          <li><strong>Data de Assinatura:</strong> {{data_assinatura}}</li>
          <li><strong>Número do Processo:</strong> {{numero_processo}}</li>
        </ul>
      </div>
      <p><strong>🔐 Validade Jurídica:</strong></p>
      <p>Seu contrato possui validade jurídica garantida por certificação blockchain:</p>
      <div class="hash">{{hash_contrato}}</div>
      <p style="text-align: center; margin-top: 30px;">
        <a href="{{link_area_cliente}}" class="button">Acessar Área do Cliente</a>
      </p>
      <p>Você pode acompanhar todo o andamento do seu processo através da Área do Cliente.</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'contract_signed',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'contract_signed'
);

-- 4. Credenciais de Acesso (user_created) - if not exists
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Credenciais de Acesso',
  'Seu acesso à Área do Cliente - WebMarcas 🔑',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .credentials { background: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .credentials p { margin: 5px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔑 Suas Credenciais de Acesso</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <p>Sua conta na Área do Cliente WebMarcas foi criada com sucesso!</p>
      <div class="credentials">
        <p><strong>📧 E-mail:</strong> {{email}}</p>
        <p><strong>🔐 Senha:</strong> {{senha}}</p>
      </div>
      <p>⚠️ <strong>Importante:</strong> Recomendamos que você altere sua senha no primeiro acesso.</p>
      <p style="text-align: center;">
        <a href="{{login_url}}" class="button">Acessar Área do Cliente</a>
      </p>
      <p>Na Área do Cliente você pode:</p>
      <ul>
        <li>Acompanhar o andamento do seu processo</li>
        <li>Visualizar documentos e contratos</li>
        <li>Acessar faturas e comprovantes</li>
        <li>Falar diretamente com nossa equipe</li>
      </ul>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'user_created',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'user_created'
);

-- 5. Confirmação de Pagamento (payment_received) - if not exists
INSERT INTO public.email_templates (name, subject, body, trigger_event, is_active)
SELECT 
  'Confirmação de Pagamento',
  'Pagamento Confirmado - WebMarcas 💳',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #0284c7; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .success-box { background: #d1fae5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 Pagamento Confirmado!</h1>
    </div>
    <div class="content">
      <p>Olá <strong>{{nome}}</strong>,</p>
      <div class="success-box">
        <h2 style="color: #059669; margin: 0;">✅ Pagamento Recebido</h2>
        <p style="margin: 10px 0 0 0;">Seu pagamento foi processado com sucesso!</p>
      </div>
      <p>Obrigado por confiar na WebMarcas para proteger sua marca. Seu pagamento foi confirmado e nosso time já está trabalhando no seu processo.</p>
      <p style="text-align: center;">
        <a href="{{link_area_cliente}}" class="button">Ver Comprovante</a>
      </p>
      <p>Se tiver alguma dúvida sobre o pagamento ou seu processo, entre em contato conosco.</p>
      <p>Atenciosamente,<br><strong>Equipe WebMarcas</strong></p>
    </div>
    <div class="footer">
      <p>WebMarcas - Especialistas em Registro de Marcas</p>
      <p>Este é um e-mail automático, por favor não responda.</p>
    </div>
  </div>
</body>
</html>',
  'payment_received',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.email_templates WHERE trigger_event = 'payment_received'
);