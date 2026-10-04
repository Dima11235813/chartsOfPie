/**
 * Authorization (authZ) for pieces — one pure function, table-tested. Roles: anonymous visitor,
 * signed-in user, admin (moderation). Visibility: private (owner only), unlisted (anyone with the
 * link), public (listed in the gallery).
 */

export type Role = 'user' | 'admin'
export type Visibility = 'private' | 'unlisted' | 'public'
export type Action = 'read' | 'update' | 'delete'

export interface Actor {
  id: string
  role: Role
}

export interface PieceAccess {
  ownerId: string
  visibility: Visibility
}

export function can(actor: Actor | null, action: Action, piece: PieceAccess): boolean {
  const isOwner = actor !== null && actor.id === piece.ownerId
  if (isOwner) return true
  switch (action) {
    case 'read':
      // Private stays private — even admins don't read it.
      return piece.visibility !== 'private'
    case 'update':
      return false
    case 'delete':
      // Moderation: admins may remove anything that others can see.
      return actor?.role === 'admin' && piece.visibility !== 'private'
  }
}
