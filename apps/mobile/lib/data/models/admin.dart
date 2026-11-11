import 'json.dart';

class AdminOrganization {
  const AdminOrganization({
    required this.id,
    required this.name,
    required this.slug,
    this.createdAt,
    required this.memberCount,
    required this.pendingInvitationCount,
  });

  final String id;
  final String name;
  final String slug;
  final DateTime? createdAt;
  final int memberCount;
  final int pendingInvitationCount;

  factory AdminOrganization.fromJson(Json json) => AdminOrganization(
    id: asString(json, 'id'),
    name: asString(json, 'name'),
    slug: asString(json, 'slug'),
    createdAt: asDate(json, 'createdAt'),
    memberCount: asInt(json, 'memberCount'),
    pendingInvitationCount: asInt(json, 'pendingInvitationCount'),
  );
}

class AdminAuditEvent {
  const AdminAuditEvent({
    required this.id,
    required this.action,
    this.actorId,
    this.actorEmail,
    this.organizationId,
    this.organizationName,
    this.targetUserId,
    this.targetEmail,
    required this.detail,
    this.createdAt,
  });

  final String id;
  final String action;
  final String? actorId;
  final String? actorEmail;
  final String? organizationId;
  final String? organizationName;
  final String? targetUserId;
  final String? targetEmail;
  final Json detail;
  final DateTime? createdAt;

  factory AdminAuditEvent.fromJson(Json json) => AdminAuditEvent(
    id: asString(json, 'id'),
    action: asString(json, 'action'),
    actorId: asStringOrNull(json, 'actorId'),
    actorEmail: asStringOrNull(json, 'actorEmail'),
    organizationId: asStringOrNull(json, 'organizationId'),
    organizationName: asStringOrNull(json, 'organizationName'),
    targetUserId: asStringOrNull(json, 'targetUserId'),
    targetEmail: asStringOrNull(json, 'targetEmail'),
    detail: asJson(json['detail']),
    createdAt: asDate(json, 'createdAt'),
  );
}
