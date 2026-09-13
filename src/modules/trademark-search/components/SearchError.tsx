import { motion } from 'framer-motion';
import { AlertCircle, RotateCcw, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OFFICIAL_ERROR_MESSAGE, type SearchApiError } from '../types';

const WHATSAPP_PHONE = '5511911120225';

export function buildWhatsAppUrl(message: string): string {
  return `https://api.whatsapp.com/send/?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}&type=phone_number&app_absent=0`;
}

export function SearchError({ error, brandName, onRetry, onReset }: {
  error: SearchApiError;
  brandName: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  const isInputError = error.code === 'invalid_input';
  const isRateLimited = error.code === 'rate_limited';
  const message = isInputError || isRateLimited ? error.message : OFFICIAL_ERROR_MESSAGE;

  const supportMessage = brandName
    ? `Olá! Tentei consultar a marca ${brandName} no site e a consulta não foi concluída. Gostaria de solicitar uma análise.`
    : 'Olá! Tentei consultar uma marca no site e a consulta não foi concluída. Gostaria de solicitar uma análise.';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-foreground" role="alert">
      <div className="flex items-start gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="p-2.5 rounded-xl bg-background border border-destructive/30 shrink-0">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold mb-1">
            {isInputError ? 'Verifique os dados informados' : 'Consulta não concluída'}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isInputError ? (
          <Button variant="outline" className="h-12 rounded-xl sm:col-span-2" onClick={onReset}>
            <RotateCcw className="w-4 h-4 mr-2" />Corrigir e consultar novamente
          </Button>
        ) : (
          <>
            <Button className="h-12 rounded-xl font-bold" onClick={onRetry} disabled={isRateLimited}>
              <RotateCcw className="w-4 h-4 mr-2" />Tentar novamente
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-xl">
              <a href={buildWhatsAppUrl(supportMessage)} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" />Solicitar análise à equipe
              </a>
            </Button>
          </>
        )}
      </div>

      {!isInputError && (
        <button type="button" onClick={onReset} className="w-full text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Fazer nova consulta com outros termos
        </button>
      )}
    </motion.div>
  );
}
