import type { ElementType } from 'react'
import type { EntryType } from '@roko/vault-core/lib/types'
import { Lock01, CreditCard01, File01, Fingerprint01, Terminal, Monitor01, Shield01, LayoutAlt04 } from '@untitledui/icons'

export interface EntryTypeMeta {
  label: string
  /** Plural label used for sidebar categories. */
  plural: string
  icon: ElementType
  titlePlaceholder: string
  /** Infrastructure items render with the Roko ink tile instead of a favicon/initials. */
  infra: boolean
}

export const ENTRY_TYPES: Record<EntryType, EntryTypeMeta> = {
  ssh: { label: 'SSH', plural: 'SSH', icon: Terminal, titlePlaceholder: 'e.g. prod-web-01', infra: true },
  rdp: { label: 'RDP', plural: 'Remote desktop', icon: Monitor01, titlePlaceholder: 'e.g. Domain controller', infra: true },
  vpn: { label: 'VPN', plural: 'VPN', icon: Shield01, titlePlaceholder: 'e.g. Office WireGuard', infra: true },
  login: { label: 'Login', plural: 'Logins', icon: Lock01, titlePlaceholder: 'e.g. GitHub', infra: false },
  passkey: { label: 'Passkey', plural: 'Passkeys', icon: Fingerprint01, titlePlaceholder: 'e.g. GitHub', infra: false },
  note: { label: 'Note', plural: 'Secure notes', icon: File01, titlePlaceholder: 'e.g. Break-glass procedure', infra: false },
  card: { label: 'Card', plural: 'Cards', icon: CreditCard01, titlePlaceholder: 'e.g. Company Visa', infra: false },
  // Items made from a template built from scratch; the template supplies the real icon and name.
  custom: { label: 'Custom', plural: 'Custom', icon: LayoutAlt04, titlePlaceholder: 'e.g. Billing database', infra: true },
}

/** Order used by the "new item" type picker. */
export const TYPE_ORDER: EntryType[] = ['ssh', 'rdp', 'vpn', 'login', 'passkey', 'note', 'card']
