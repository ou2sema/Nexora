# ADR-0012 — Platform administration and role refinement

- **Status:** accepted
- **Date:** 2026-10-31
- **Deciders:** product owner, engineering

## Context

Phase 9 gave each organization an owner/admin/manager/viewer hierarchy and
email-keyed invitations. Two gaps remain:

1. Organizations can only be created self-service, by the person who becomes their
   owner. The operator of the deployment therefore cannot onboard a customer or create
   an organization on someone else's behalf.
2. Managers are read/write operators for catalog, stock, devices, orders, and counts,
   but they cannot add anyone to their own team. Owners and admins do all member
   management.

The product owner wants an application-level administrator — “Platform admin” in the
interface — who manages the whole deployment: creates organizations, chooses which
organization a manager belongs to, and manages teams across organizations. Managers
should manage their own organization and be able to add viewers only.

The existing implementation deliberately has no service-role key in the API and no
admin API for identity. Any new capability must keep the API on JWKS and keep tenant
business data isolated.

## Decisions

### 1. Platform administration is a user flag, not an organization role

`public.profiles.is_platform_admin` is a boolean, default `false`. `app.is_platform_admin()`
is a security-definer helper that answers for the caller only. It is bootstrapped in the
migration for `ou3sema@gmail.com`.

There is intentionally no API to grant the flag. It is provisioned by database
administration (migration or operator SQL), never by an HTTP call, so an organization
owner cannot escalate themselves into a deployment administrator. The flag survives
email changes and is visible only through the caller's own `/me` response.

Organization roles stay exactly as they are: `owner`, `admin`, `manager`, `viewer`.
“Platform admin” is a separate capability shown as a badge in the interface, not a fifth
membership role.

### 2. Only platform administrators create organizations

`app.create_organization` now requires `app.is_platform_admin()` and raises
`platform_admin_required` otherwise. `POST /api/v1/organizations` keeps its shape but
the role required in the API table becomes platform admin.

The creating platform admin becomes the new organization's owner, which preserves the
“every organization has an owner” invariant and lets them hand over ownership later.
The creation form can optionally invite the first member (admin, manager, or viewer) in
the same transaction, so an administrator can create an organization and put its first
manager in place in one action. Invitations still never grant `owner`; ownership is
assigned by changing a member's role after they accept.

### 3. Platform admins manage identity and membership across organizations

Platform admins may list every organization, its members, and its invitations, and may
invite, revoke, change roles, and remove members in any organization. They are not
subject to the “only an owner touches an owner” rule, but the existing
`protect_last_owner` trigger still prevents an organization from losing its last owner.

This is deliberately scoped to **identity and organization administration**. Platform
admins do not gain access to catalog, stock, devices, orders, reports, or documents
unless they are ordinary members of that organization. Tenant business data keeps the
Phase 3–9 boundary; administration reads use the same RLS policies with an explicit
platform-admin clause.

### 4. Managers invite viewers only

Managers may read their organization's invitations and create viewer invitations. The
definer function rejects any other role for a manager with
`manager_invites_viewers_only`; owners, admins, and platform admins may invite
admin/manager/viewer roles. Managers still cannot change roles, remove members, or
revoke invitations. This matches “the manager can only manage his organization and add
viewers” without widening the Phase 9 owner hierarchy.

### 5. Enforcement stays in definer functions, mirrored by RLS

Every write remains a security-definer function with precise errors. Organization-level
RLS policies are extended with `or app.is_platform_admin()` for reads and membership
writes, and the invitation read policy now includes managers for their own
organization. A platform admin's direct PostgREST access is therefore governed by the
same rules as the API, and the last-owner trigger remains the backstop for every path.

The API service mirrors the role checks to return 404 for outsiders and 403 for
insufficient roles before the database is touched. `TenantAccessService.runAsTeamMember`
returns the caller's membership role plus the platform flag so team endpoints can keep
the manager exception explicit.

## Consequences

- A platform administrator can onboard an organization and its first manager without
  being a member of it; they do become its owner at creation.
- Platform admins can read member identities across tenants. That is the purpose of the
  role, and it is limited to `profiles`, memberships, organizations, and invitations.
- Managers can invite viewers and see the invitation list for their own organization;
  they cannot promote anyone, remove anyone, or invite an admin/manager.
- Provisioning a second platform admin requires database access, by design. There is no
  in-product grant path yet.
- Still out of scope: organization deletion, ownership transfer as a single action,
  audit-log UI for platform-admin actions, and per-tenant platform-admin delegation.
