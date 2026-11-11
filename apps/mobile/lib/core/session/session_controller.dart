import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../data/models/account.dart';
import '../app_providers.dart';
import '../auth/permissions.dart';
import '../errors/api_exception.dart';
import '../storage/scoped_store.dart';

enum SessionPhase {
  starting,
  signedOut,
  loading,
  ready,
  needsOrganization,
  failed,
}

class SessionState {
  const SessionState({
    required this.phase,
    this.userId,
    this.email,
    this.me,
    this.organizationId,
    this.failure,
    this.authMessage,
    this.authBusy = false,
    this.awaitingConfirmation = false,
  });

  const SessionState.starting() : this(phase: SessionPhase.starting);

  const SessionState.signedOut({String? message, bool busy = false})
    : this(phase: SessionPhase.signedOut, authMessage: message, authBusy: busy);

  final SessionPhase phase;
  final String? userId;
  final String? email;
  final MeResponse? me;
  final String? organizationId;
  final ApiException? failure;
  final String? authMessage;
  final bool authBusy;
  final bool awaitingConfirmation;

  List<Membership> get memberships => me?.memberships ?? const [];

  Membership? get membership => me?.membershipFor(organizationId);

  MemberRole get role => membership?.role ?? MemberRole.viewer;

  bool get platformAdmin => me?.user.platformAdmin ?? false;

  bool get isReady => phase == SessionPhase.ready && membership != null;

  SessionState copyWith({
    SessionPhase? phase,
    String? userId,
    String? email,
    MeResponse? me,
    String? organizationId,
    bool clearOrganization = false,
    ApiException? failure,
    bool clearFailure = false,
    String? authMessage,
    bool clearAuthMessage = false,
    bool? authBusy,
    bool? awaitingConfirmation,
  }) => SessionState(
    phase: phase ?? this.phase,
    userId: userId ?? this.userId,
    email: email ?? this.email,
    me: me ?? this.me,
    organizationId: clearOrganization
        ? null
        : (organizationId ?? this.organizationId),
    failure: clearFailure ? null : (failure ?? this.failure),
    authMessage: clearAuthMessage ? null : (authMessage ?? this.authMessage),
    authBusy: authBusy ?? this.authBusy,
    awaitingConfirmation: awaitingConfirmation ?? this.awaitingConfirmation,
  );
}

/// Owns the signed-in identity and the selected workspace. Supabase answers who
/// the user is; the API answers which organizations and roles that user has.
class SessionController extends Notifier<SessionState> {
  StreamSubscription<AuthState>? _authSubscription;
  int _generation = 0;

  @override
  SessionState build() {
    final supabase = ref.watch(supabaseClientProvider);
    _authSubscription?.cancel();
    _authSubscription = supabase.auth.onAuthStateChange.listen(_onAuthChange);
    ref.onDispose(() => _authSubscription?.cancel());

    final session = supabase.auth.currentSession;
    if (session == null) {
      return const SessionState.signedOut();
    }
    Future.microtask(() => _loadWorkspace(session.user.id, session.user.email));
    return SessionState(
      phase: SessionPhase.loading,
      userId: session.user.id,
      email: session.user.email,
    );
  }

  void _onAuthChange(AuthState authState) {
    final session = authState.session;
    if (session == null) {
      if (state.phase != SessionPhase.signedOut) {
        state = const SessionState.signedOut();
      }
      return;
    }
    if (session.user.id == state.userId &&
        (state.phase == SessionPhase.ready ||
            state.phase == SessionPhase.loading)) {
      return;
    }
    unawaited(_loadWorkspace(session.user.id, session.user.email));
  }

  Future<void> _loadWorkspace(String userId, String? email) async {
    final generation = ++_generation;
    if (ref.read(apiBaseUrlProvider) == null) {
      state = SessionState(
        phase: SessionPhase.failed,
        userId: userId,
        email: email,
        failure: const ApiException(
          kind: ApiFailureKind.network,
          code: 'api_not_configured',
          message: 'No API address is configured on this device.',
        ),
      );
      return;
    }
    state = state.copyWith(
      phase: SessionPhase.loading,
      userId: userId,
      email: email,
      clearFailure: true,
    );

    try {
      final me = await ref.read(nexoraApiProvider).me();
      if (generation != _generation) return;

      final saved = await ScopedStore.readSelectedOrganization(userId);
      String? organizationId = state.organizationId;
      if (me.membershipFor(organizationId) == null) {
        organizationId = me.membershipFor(saved) != null
            ? saved
            : (me.memberships.isEmpty
                  ? null
                  : me.memberships.first.organizationId);
      }
      if (organizationId != null) {
        await ScopedStore.writeSelectedOrganization(userId, organizationId);
      }

      state = SessionState(
        phase: organizationId == null
            ? SessionPhase.needsOrganization
            : SessionPhase.ready,
        userId: userId,
        email: email ?? me.user.email,
        me: me,
        organizationId: organizationId,
      );
    } on ApiException catch (error) {
      if (generation != _generation) return;
      if (error.isUnauthorized) {
        state = const SessionState.signedOut();
        return;
      }
      state = state.copyWith(phase: SessionPhase.failed, failure: error);
    }
  }

  Future<void> signIn(String email, String password) async {
    final supabase = ref.read(supabaseClientProvider);
    state = state.copyWith(
      authBusy: true,
      clearAuthMessage: true,
      clearFailure: true,
    );
    try {
      final response = await supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );
      final session = response.session;
      if (session == null) {
        state = const SessionState.signedOut(message: 'auth_failed');
        return;
      }
      await _loadWorkspace(session.user.id, session.user.email);
    } on AuthException catch (error) {
      state = SessionState.signedOut(message: error.message);
    } catch (_) {
      state = const SessionState.signedOut(message: 'auth_failed');
    }
  }

  Future<void> signUp(String email, String password) async {
    final supabase = ref.read(supabaseClientProvider);
    state = state.copyWith(
      authBusy: true,
      clearAuthMessage: true,
      clearFailure: true,
    );
    try {
      final response = await supabase.auth.signUp(
        email: email,
        password: password,
      );
      final session = response.session;
      if (session == null) {
        state = const SessionState.signedOut().copyWith(
          awaitingConfirmation: true,
          authBusy: false,
        );
        return;
      }
      await _loadWorkspace(session.user.id, session.user.email);
    } on AuthException catch (error) {
      state = SessionState.signedOut(message: error.message);
    } catch (_) {
      state = const SessionState.signedOut(message: 'auth_failed');
    }
  }

  Future<void> signOut() async {
    final userId = state.userId;
    if (userId != null) {
      await ScopedStore.clearUserDrafts(userId);
    }
    await ref.read(supabaseClientProvider).auth.signOut();
    _generation++;
    state = SessionState.signedOut();
  }

  Future<void> selectOrganization(String organizationId) async {
    final membership = state.me?.membershipFor(organizationId);
    if (membership == null) return;
    final userId = state.userId;
    if (userId != null) {
      await ScopedStore.writeSelectedOrganization(userId, organizationId);
    }
    state = state.copyWith(
      phase: SessionPhase.ready,
      organizationId: organizationId,
      clearFailure: true,
    );
  }

  /// Re-reads memberships after creating an organization or accepting an
  /// invitation, optionally moving straight into the new workspace.
  Future<void> refreshWorkspace({String? selectOrganizationId}) async {
    final userId = state.userId;
    if (userId == null) return;
    await _loadWorkspace(userId, state.email);
    if (selectOrganizationId != null) {
      await selectOrganization(selectOrganizationId);
    }
  }

  void clearAuthMessage() => state = state.copyWith(clearAuthMessage: true);
}
