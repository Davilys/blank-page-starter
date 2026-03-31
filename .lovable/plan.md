

## Fix: Resumo do Pedido showing dynamic price

### Problem
Line 135 of `src/pages/Obrigado.tsx` has a hardcoded `R$ 698,97` instead of using the actual payment value from `registrationData.paymentValue`.

### Changes

**File: `src/pages/Obrigado.tsx`**

1. Replace the hardcoded value on line 135 with a dynamic formatted value:
   - Use `registrationData.paymentValue` formatted with `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
   - Fallback to `R$ 698,97` if `paymentValue` is missing

2. Add a row showing the selected plan/payment method (e.g., "PIX à vista", "6x Cartão", "3x Boleto") using `registrationData.paymentMethod` — so the client sees what they chose.

3. Fix the `trackPurchase` call (line 25) which already uses `parsedData.paymentValue || 698.97` — this is correct but will also benefit from the same data.

### Summary of display changes

| Field | Before | After |
|-------|--------|-------|
| Valor | Hardcoded `R$ 698,97` | Dynamic from `registrationData.paymentValue` |
| Forma de Pagamento | Not shown | New row showing method (PIX/Cartão/Boleto) |

Single file change, minimal scope.

