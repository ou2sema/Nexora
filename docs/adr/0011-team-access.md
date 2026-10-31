# ADR-0011 — Team access and invitations

- **Status:** accepted
- **Date:** 2026-10-31
- **Deciders:** product owner, engineering

## Context

Roles and memberships have existed since Phase 1, but the only way to add a person to an
organization is a direct SQL insert or the Supabase dashboard. The Team screen needs three
things the current schema cannot provide: a readable email for each member, a way to invite
someone who is not a member yet, and a guarded path for changing or removing roles.

`memberships.user_id` references `auth.users`, which the `authenticated` role cannot read.
There is no profiles table. Using Supabase's admin invite API would require a service-role key
in the API process, which contradicts the JWKS-only design the API has followed so far.

## Decisions

### 1. A `public.profiles` projection, synced from `auth.users`

`profiles` holds `id` (the user id), `email`, and timestamps. A security-definer trigger on
`auth.users` inserts and updates the row whenever an account is created or its email changes,
and a backfill covers pre-existing accounts. Only `select` is granted; the auth schema remains
the source of truth and nothing writes to a profile from the application.

RLS exposes a profile only to the account itself or to people who share an organization with
it. Emails therefore never leak across tenants, and the Team screen can list members without a
second identity store.

### 2. Invitations are rows keyed by email, not Supabase admin invites

`organization_invitations` stores the organization, the normalized (lowercase) email, the role,
the inviter, an expiry (`now() + 14 days`), and `accepted_at` / `revoked_at`. A partial unique
index allows one live invitation per organization and email; stale rows are revoked by the
invitation RPC before a reissue, so an expired invite never blocks a new one.

The invitation API is owner/admin-only and calls definer functions. It does not send email:
the invitee discovers pending invitations after signing in. This keeps the API on JWKS and
avoids a service-role key, at the cost of no outbound invitation message and no support for
people who cannot sign in themselves.

### 3. Acceptance is matched to the caller's verified email

`app.current_user_email()` reads the `email` claim from the same `request.jwt.claims` setting
used for the subject, and `app.accept_invitation(invitation)` is a definer function that only
succeeds when that normalized email equals the invitation's email. Accepting inserts the
membership with the invited role (invitations can never grant `owner`), stamps `accepted_at`,
and returns the organization id. Re-accepting an already-accepted invitation is idempotent for
a member and fails for everyone else.

The auth API now includes the email claim in the transaction claims, so policies and RPCs see
the same identity the JWT verified.

### 4. Role changes and removals obey an owner hierarchy

Owners and admins manage members. Only an owner may touch an owner: an admin cannot promote
anyone to owner, demote an owner, or remove an owner. The existing `protect_last_owner` trigger
still guarantees that an organization cannot lose its last owner. A member can change their own
role where the rules allow it (for example an owner demoting themselves when another owner
exists), and the same rules are mirrored in the RLS policies on `memberships` so the API cannot
be bypassed through PostgREST.

Guards live in definer functions (`change_member_role`, `remove_organization_member`) and are
expressed again as RLS `using` / `with check` expressions. The functions give precise errors;
the policies remain the backstop.

### 5. RLS reads, definer writes

Member lists read `memberships` joined to `profiles` under RLS. Pending invitations for the
signed-in user come from a definer function that filters on their own claim email, so the
organizations table does not need a policy that would expose organizations to unaffiliated
people. All invitation and membership mutations are definer functions; the tables grant only
`select` (invitations, profiles) or the pre-existing constrained write policies (memberships).

## Consequences

- A person added today appears in the Team list with an email, role, and join date.
- Invitations are self-service within the product, but silent: the invitee must sign in and
  notice the pending banner on their own.
- Because roles are per organization, a person can be an owner in one organization and a
  viewer in another; there are no cross-organization role bundles.
- Still out of scope: outbound email, domain-based or link invitations, transfer of ownership
  as a distinct action, and arbitrary permission bundles. Ownership transfer is expressed as
  making another member an owner first, then stepping down.
