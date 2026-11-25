'use client'

import type { ElementType } from 'react'
import type { TemplateIcon } from '@/lib/types'
import {
  Activity, Archive, Bank, BarChart01, Bell01, Bookmark, Box, Briefcase01, Building07, Calendar, Cloud01, Code01,
  Code02, CodeSquare01, Command, Container, CreditCard01, Cube01, Database01, Database03, Dataflow01, File06,
  FileCode01, FileShield02, Fingerprint01, Flag01, Folder, GitBranch01, Globe01, Globe02, HardDrive, Heart, Key01,
  Key02, Laptop01, Lightning01, Link01, Lock01, Lock03, Mail01, Monitor01, Package, Passcode, Phone01, Printer,
  Receipt, Rocket01, Route, Server01, Server03, Settings01, Shield01, Shield03, ShieldTick, Signal01, Star01, Tag01,
  Terminal, Users01, Wallet02, Webcam01, Wifi, Zap,
} from '@untitledui/icons'

/** The built-in SVG icon library offered in the template editor. */
export const ICON_LIBRARY: Record<string, ElementType> = {
  Terminal, Server01, Server03, Database01, Database03, HardDrive, Container, Cloud01, Globe01, Globe02, Wifi,
  Signal01, Route, Dataflow01, GitBranch01, Code01, Code02, CodeSquare01, FileCode01, Command, Laptop01, Monitor01,
  Phone01, Webcam01, Printer, Key01, Key02, Lock01, Lock03, Passcode, Fingerprint01, Shield01, Shield03, ShieldTick,
  FileShield02, Mail01, Link01, Users01, Building07, Briefcase01, CreditCard01, Wallet02, Bank, Receipt, Package, Box,
  Cube01, Archive, Folder, File06, Tag01, Bookmark, Rocket01, Lightning01, Zap, Activity, BarChart01, Calendar, Bell01,
  Settings01, Flag01, Star01, Heart,
}

/** Words to match when searching the library (icon names are terse). */
export const ICON_KEYWORDS: Record<string, string> = {
  Terminal: 'ssh shell console cli', Server01: 'server host machine', Server03: 'server rack cluster',
  Database01: 'database db sql postgres mysql', Database03: 'database db redis mongo', HardDrive: 'disk storage nas',
  Container: 'docker kubernetes k8s container', Cloud01: 'cloud aws azure gcp', Globe01: 'web website domain dns',
  Globe02: 'internet network', Wifi: 'wifi wireless network', Signal01: 'signal radio iot', Route: 'router gateway route',
  Dataflow01: 'pipeline flow api', GitBranch01: 'git github gitlab repo', Code01: 'code dev', Code02: 'code api',
  CodeSquare01: 'code script', FileCode01: 'config yaml env', Command: 'command mac', Laptop01: 'laptop workstation',
  Monitor01: 'rdp desktop screen', Phone01: 'phone mobile sim', Webcam01: 'camera cctv', Printer: 'printer',
  Key01: 'key api token', Key02: 'key license', Lock01: 'lock password', Lock03: 'lock secure', Passcode: 'pin passcode',
  Fingerprint01: 'passkey biometric', Shield01: 'vpn firewall', Shield03: 'security', ShieldTick: 'verified secure',
  FileShield02: 'certificate tls ssl', Mail01: 'email smtp mail', Link01: 'link url webhook', Users01: 'team users group',
  Building07: 'office company org', Briefcase01: 'work business', CreditCard01: 'card payment', Wallet02: 'wallet crypto',
  Bank: 'bank finance', Receipt: 'billing invoice', Package: 'package npm registry', Box: 'box storage s3',
  Cube01: 'cube 3d app', Archive: 'archive backup', Folder: 'folder files', File06: 'document file', Tag01: 'tag label',
  Bookmark: 'bookmark', Rocket01: 'deploy launch', Lightning01: 'fast function lambda', Zap: 'power webhook',
  Activity: 'monitoring metrics', BarChart01: 'analytics chart', Calendar: 'calendar', Bell01: 'alerts notification',
  Settings01: 'settings admin', Flag01: 'feature flag', Star01: 'star favorite', Heart: 'heart',
}

/** Just the glyph, sized to `size`. Uploaded SVGs render through <img>, so scripts in them never run. */
export function TemplateGlyph({ icon, size = 20 }: { icon: TemplateIcon; size?: number }) {
  if (icon.kind === 'emoji') {
    return (
      <span aria-hidden style={{ fontSize: Math.round(size * 0.95), lineHeight: 1, fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}>
        {icon.value}
      </span>
    )
  }
  if (icon.kind === 'svg') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={icon.dataUrl} alt="" width={size} height={size} style={{ objectFit: 'contain', width: size, height: size }} />
  }
  const Icon = ICON_LIBRARY[icon.name] ?? Key01
  return <Icon size={size} />
}

/**
 * A template icon on a tile. Library icons use the Roko ink tile with an ember
 * glyph; emojis and uploaded SVGs sit on a neutral tile so their own colours show.
 */
export function TemplateTile({ icon, size = 32 }: { icon: TemplateIcon; size?: number }) {
  const library = icon.kind === 'library'
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: library ? 'var(--ink-900)' : 'var(--color-bg-secondary)',
        color: library ? 'var(--ember-500)' : undefined,
        boxShadow: library ? 'inset 0 0 0 1px rgb(255 255 255 / 0.08)' : 'inset 0 0 0 1px var(--color-border-secondary)',
      }}
    >
      <TemplateGlyph icon={icon} size={Math.round(size * 0.5)} />
    </span>
  )
}
