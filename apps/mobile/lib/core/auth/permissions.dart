enum MemberRole {
  owner,
  admin,
  manager,
  viewer;

  static MemberRole parse(String? value) => switch (value) {
    'owner' => MemberRole.owner,
    'admin' => MemberRole.admin,
    'manager' => MemberRole.manager,
    _ => MemberRole.viewer,
  };

  String get wire => name;

  bool get canWrite => this != MemberRole.viewer;
  bool get canManageTeam =>
      this == MemberRole.owner || this == MemberRole.admin;
  bool get canChangeOwner => this == MemberRole.owner;
  bool get canReconcile => this == MemberRole.owner || this == MemberRole.admin;
  bool get canManageBranding => canWrite;
  bool get canInvite =>
      this == MemberRole.owner ||
      this == MemberRole.admin ||
      this == MemberRole.manager;

  bool canInviteRole(MemberRole role) {
    if (this == MemberRole.owner) return role != MemberRole.owner;
    if (this == MemberRole.admin) return role != MemberRole.owner;
    if (this == MemberRole.manager) return role == MemberRole.viewer;
    return false;
  }
}
