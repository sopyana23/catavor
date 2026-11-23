interface OrderPayment {
  payment_mode?: string
  payment_method?: string
  gateway_provider?: string
  gateway_reference?: string
  gateway_payment_link?: string
  coupon_code?: string
  final_amount?: number
  original_amount?: number
  discount_amount?: number
  amount?: number
  price?: number
}

export function paymentChannel(order: OrderPayment) {
  const mode = order.payment_mode?.trim().toLowerCase()
  const method = order.payment_method?.trim().toLowerCase() ?? ''
  const total = order.final_amount ?? order.amount ?? order.price
  const coveredByDiscount = Number(order.original_amount) > 0 && Number(order.discount_amount) >= Number(order.original_amount)
  if (mode === 'coupon_free' || method === 'free' || method === 'coupon_free' ||
      (total != null && Number(total) === 0 && (order.coupon_code?.trim() || coveredByDiscount))) return 'coupon_free'
  if (mode === 'gateway_aulaa' || order.gateway_provider?.toLowerCase() === 'aulaa' ||
      order.gateway_reference?.trim() || order.gateway_payment_link?.trim() ||
      method.startsWith('aulaa') || ['va', 'ewallet', 'cc', 'card'].includes(method)) return 'gateway_aulaa'
  return method.includes('qris') ? 'manual_qris' : 'manual_bank'
}

export function formatGatewayResponse(value: unknown) {
  if (value == null) return ''
  return typeof value === 'string' ? value.trim() : JSON.stringify(value, null, 2)
}
