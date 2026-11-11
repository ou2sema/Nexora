import '../../core/auth/permissions.dart';
import 'json.dart';

class TeamMember {
  const TeamMember({
    required this.userId,
    this.email,
    required this.role,
    this.joinedAt,
  });

  final String userId;
  final String? email;
  final MemberRole role;
  final DateTime? joinedAt;

  factory TeamMember.fromJson(Json json) => TeamMember(
    userId: asString(json, 'userId'),
    email: asStringOrNull(json, 'email'),
    role: MemberRole.parse(asStringOrNull(json, 'role')),
    joinedAt: asDate(json, 'joinedAt'),
  );
}

enum InvitationStatus {
  pending,
  expired,
  accepted,
  revoked;

  static InvitationStatus parse(String? wire) =>
      enumFromWire(InvitationStatus.values, wire, InvitationStatus.pending);
}

class Invitation {
  const Invitation({
    required this.id,
    required this.email,
    required this.role,
    required this.status,
    this.invitedByEmail,
    this.createdAt,
    this.expiresAt,
  });

  final String id;
  final String email;
  final MemberRole role;
  final InvitationStatus status;
  final String? invitedByEmail;
  final DateTime? createdAt;
  final DateTime? expiresAt;

  factory Invitation.fromJson(Json json) => Invitation(
    id: asString(json, 'id'),
    email: asString(json, 'email'),
    role: MemberRole.parse(asStringOrNull(json, 'role')),
    status: InvitationStatus.parse(asStringOrNull(json, 'status')),
    invitedByEmail: asStringOrNull(json, 'invitedByEmail'),
    createdAt: asDate(json, 'createdAt'),
    expiresAt: asDate(json, 'expiresAt'),
  );
}
