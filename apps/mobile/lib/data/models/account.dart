import '../../core/auth/permissions.dart';
import 'json.dart';

class LogoSummary {
  const LogoSummary({
    required this.organizationId,
    required this.mime,
    required this.byteLength,
    required this.updatedAt,
  });

  final String organizationId;
  final String mime;
  final int byteLength;
  final DateTime? updatedAt;

  factory LogoSummary.fromJson(Json json) => LogoSummary(
    organizationId: asString(json, 'organizationId'),
    mime: asString(json, 'mime', 'image/png'),
    byteLength: asInt(json, 'byteLength'),
    updatedAt: asDate(json, 'updatedAt'),
  );
}

class Membership {
  const Membership({
    required this.organizationId,
    required this.organizationName,
    required this.organizationSlug,
    required this.role,
    this.logo,
  });

  final String organizationId;
  final String organizationName;
  final String organizationSlug;
  final MemberRole role;
  final LogoSummary? logo;

  factory Membership.fromJson(Json json) {
    final logo = asJsonOrNull(json['logo']);
    return Membership(
      organizationId: asString(json, 'organizationId'),
      organizationName: asString(json, 'organizationName'),
      organizationSlug: asString(json, 'organizationSlug'),
      role: MemberRole.parse(asStringOrNull(json, 'role')),
      logo: logo == null ? null : LogoSummary.fromJson(logo),
    );
  }
}

class AppUser {
  const AppUser({required this.id, this.email, required this.platformAdmin});

  final String id;
  final String? email;
  final bool platformAdmin;

  factory AppUser.fromJson(Json json) => AppUser(
    id: asString(json, 'id'),
    email: asStringOrNull(json, 'email'),
    platformAdmin: asBool(json, 'platformAdmin'),
  );
}

class MeResponse {
  const MeResponse({required this.user, required this.memberships});

  final AppUser user;
  final List<Membership> memberships;

  factory MeResponse.fromJson(Json json) => MeResponse(
    user: AppUser.fromJson(asJson(json['user'])),
    memberships: asJsonList(json['memberships'])
        .map(Membership.fromJson)
        .toList(growable: false),
  );

  Membership? membershipFor(String? organizationId) {
    if (organizationId == null) return null;
    for (final membership in memberships) {
      if (membership.organizationId == organizationId) return membership;
    }
    return null;
  }
}

class PendingInvitation {
  const PendingInvitation({
    required this.id,
    required this.organizationId,
    required this.organizationName,
    required this.organizationSlug,
    required this.role,
    required this.expiresAt,
  });

  final String id;
  final String organizationId;
  final String organizationName;
  final String organizationSlug;
  final MemberRole role;
  final DateTime? expiresAt;

  factory PendingInvitation.fromJson(Json json) => PendingInvitation(
    id: asString(json, 'id'),
    organizationId: asString(json, 'organizationId'),
    organizationName: asString(json, 'organizationName'),
    organizationSlug: asString(json, 'organizationSlug'),
    role: MemberRole.parse(asStringOrNull(json, 'role')),
    expiresAt: asDate(json, 'expiresAt'),
  );
}

class CreatedOrganization {
  const CreatedOrganization({
    required this.id,
    required this.name,
    required this.slug,
    required this.role,
  });

  final String id;
  final String name;
  final String slug;
  final MemberRole role;

  factory CreatedOrganization.fromJson(Json json) => CreatedOrganization(
    id: asString(json, 'id'),
    name: asString(json, 'name'),
    slug: asString(json, 'slug'),
    role: MemberRole.parse(asStringOrNull(json, 'role')),
  );
}
