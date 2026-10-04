import type { AccountState } from '../account/useAccount'

/** Sign in / out (only shown when the build has an API configured). */
export function AccountBar({ account }: { account: AccountState }) {
  if (!account.enabled) return null
  if (account.busy) return <p className="account-bar hint">Signing in…</p>
  return (
    <div className="account-bar">
      {account.user ? (
        <>
          {account.user.avatarUrl && (
            <img className="avatar" src={account.user.avatarUrl} alt="" width={28} height={28} />
          )}
          <span>{account.user.name}</span>
          <button type="button" className="btn btn-small" onClick={() => void account.signOut()}>
            Sign out
          </button>
        </>
      ) : (
        <button type="button" className="btn btn-small" onClick={account.signIn}>
          Sign in with GitHub
        </button>
      )}
      {account.error && (
        <span className="notice error" role="status">
          {account.error}
        </span>
      )}
    </div>
  )
}
