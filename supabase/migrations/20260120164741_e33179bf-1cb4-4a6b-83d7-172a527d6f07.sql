-- =====================================================
-- SECURITY HARDENING: RLS Policies Improvements (Fixed)
-- =====================================================

-- =====================================================
-- PROFILES: Block anonymous access, allow only authenticated users
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON profiles;

CREATE POLICY "Authenticated users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CONTRACTS: Only owner or admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can insert own contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update own contracts" ON contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON contracts;

CREATE POLICY "Users can view own contracts"
ON contracts FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own contracts"
ON contracts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can update own contracts"
ON contracts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contracts"
ON contracts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- INVOICES: Only owner or admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;

CREATE POLICY "Users can view own invoices"
ON invoices FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert invoices"
ON invoices FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update invoices"
ON invoices FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete invoices"
ON invoices FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- LEADS: Only admins can access (keep public insert for forms)
-- =====================================================
DROP POLICY IF EXISTS "Admins can view all leads" ON leads;
DROP POLICY IF EXISTS "Admins can insert leads" ON leads;
DROP POLICY IF EXISTS "Admins can update leads" ON leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON leads;
DROP POLICY IF EXISTS "Public can create leads with valid data" ON leads;

CREATE POLICY "Admins can view all leads"
ON leads FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert leads"
ON leads FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public can create leads with valid data"
ON leads FOR INSERT
TO anon
WITH CHECK (
  full_name IS NOT NULL AND 
  char_length(full_name) >= 2 AND 
  char_length(full_name) <= 100
);

CREATE POLICY "Admins can update leads"
ON leads FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete leads"
ON leads FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- EMAIL_ACCOUNTS: Only admins can access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can insert email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can update email_accounts" ON email_accounts;
DROP POLICY IF EXISTS "Admins can delete email_accounts" ON email_accounts;

CREATE POLICY "Admins can view email_accounts"
ON email_accounts FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email_accounts"
ON email_accounts FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email_accounts"
ON email_accounts FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email_accounts"
ON email_accounts FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- EMAIL_INBOX: Only admins can access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view email_inbox" ON email_inbox;
DROP POLICY IF EXISTS "Admins can insert email_inbox" ON email_inbox;
DROP POLICY IF EXISTS "Admins can update email_inbox" ON email_inbox;
DROP POLICY IF EXISTS "Admins can delete email_inbox" ON email_inbox;

CREATE POLICY "Admins can view email_inbox"
ON email_inbox FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert email_inbox"
ON email_inbox FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update email_inbox"
ON email_inbox FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete email_inbox"
ON email_inbox FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- WHATSAPP_CONFIG: Only admins can access
-- =====================================================
DROP POLICY IF EXISTS "Admins can view whatsapp_config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admins can insert whatsapp_config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admins can update whatsapp_config" ON whatsapp_config;
DROP POLICY IF EXISTS "Admins can delete whatsapp_config" ON whatsapp_config;

CREATE POLICY "Admins can view whatsapp_config"
ON whatsapp_config FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert whatsapp_config"
ON whatsapp_config FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update whatsapp_config"
ON whatsapp_config FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete whatsapp_config"
ON whatsapp_config FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- =====================================================
-- CHAT_MESSAGES: User isolation with admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own chat messages or admin can view all" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert own chat messages" ON chat_messages;
DROP POLICY IF EXISTS "Admins can manage chat messages" ON chat_messages;

CREATE POLICY "Users can view own chat messages or admin can view all"
ON chat_messages FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own chat messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- LOGIN_HISTORY: User isolation with admin access
-- =====================================================
DROP POLICY IF EXISTS "Users can view own login history or admin can view all" ON login_history;
DROP POLICY IF EXISTS "System can insert login history" ON login_history;

CREATE POLICY "Users can view own login history or admin can view all"
ON login_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert login history"
ON login_history FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- SIGNATURE_AUDIT_LOG: Contract owner or admin access
-- =====================================================
DROP POLICY IF EXISTS "Admins and contract owners can view signature audit log" ON signature_audit_log;
DROP POLICY IF EXISTS "System can insert signature audit log" ON signature_audit_log;

CREATE POLICY "Admins and contract owners can view signature audit log"
ON signature_audit_log FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  EXISTS (
    SELECT 1 FROM contracts 
    WHERE contracts.id = signature_audit_log.contract_id 
    AND contracts.user_id = auth.uid()
  )
);

CREATE POLICY "System can insert signature audit log"
ON signature_audit_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- =====================================================
-- VIABILITY_SEARCHES: Restrict reads to authenticated users
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can view recent viability searches" ON viability_searches;
DROP POLICY IF EXISTS "Anyone can insert viability searches" ON viability_searches;

CREATE POLICY "Authenticated users can view recent viability searches"
ON viability_searches FOR SELECT
TO authenticated
USING (created_at > now() - interval '24 hours');

CREATE POLICY "Anyone can insert viability searches"
ON viability_searches FOR INSERT
TO anon, authenticated
WITH CHECK (true);