import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/widgets.dart';

class SignInScreen extends ConsumerStatefulWidget {
  const SignInScreen({super.key});

  @override
  ConsumerState<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends ConsumerState<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _signUp = false;
  bool _obscure = true;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    final controller = ref.read(sessionProvider.notifier);
    if (_signUp) {
      await controller.signUp(_email.text.trim(), _password.text);
    } else {
      await controller.signIn(_email.text.trim(), _password.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    final preferences = ref.watch(preferencesProvider);
    final l10n = context.l10n;

    if (session.awaitingConfirmation) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(NexoraSpace.xl),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _BrandMark(),
                    const SizedBox(height: NexoraSpace.xl),
                    NexoraCard(
                      child: Column(
                        children: [
                          Icon(
                            Icons.mark_email_read_outlined,
                            size: 42,
                            color: context.colors.primary,
                          ),
                          const SizedBox(height: NexoraSpace.md),
                          Text(
                            l10n.authCheckInbox,
                            style: context.texts.titleLarge,
                          ),
                          const SizedBox(height: NexoraSpace.sm),
                          Text(
                            l10n.authConfirmationSent(_email.text.trim()),
                            textAlign: TextAlign.center,
                            style: context.texts.bodyMedium,
                          ),
                          const SizedBox(height: NexoraSpace.lg),
                          OutlinedButton(
                            onPressed: () {
                              ref
                                  .read(sessionProvider.notifier)
                                  .clearAuthMessage();
                              setState(() => _signUp = false);
                            },
                            child: Text(l10n.authBackToSignIn),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 32, 24, 32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 440),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const _BrandMark(),
                      const SizedBox(height: NexoraSpace.xxl),
                      Text(
                        _signUp ? l10n.authSignUpTitle : l10n.authSignInTitle,
                        style: context.texts.headlineLarge,
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      Text(
                        _signUp
                            ? l10n.authSignUpSubtitle
                            : l10n.authSignInSubtitle,
                        style: context.texts.bodyMedium?.copyWith(
                          color: context.colors.onSurfaceVariant,
                        ),
                      ),
                      const SizedBox(height: NexoraSpace.xl),
                      if (session.authMessage != null) ...[
                        _AuthBanner(message: _messageFor(session.authMessage!)),
                        const SizedBox(height: NexoraSpace.lg),
                      ],
                      Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextFormField(
                              controller: _email,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              textInputAction: TextInputAction.next,
                              decoration: InputDecoration(
                                labelText: l10n.authEmail,
                                prefixIcon: const Icon(
                                  Icons.alternate_email_rounded,
                                ),
                              ),
                              validator: (value) {
                                final email = value?.trim() ?? '';
                                if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                                    .hasMatch(email)) {
                                  return l10n.authInvalidEmail;
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: NexoraSpace.md),
                            TextFormField(
                              controller: _password,
                              obscureText: _obscure,
                              autofillHints: const [AutofillHints.password],
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                labelText: l10n.authPassword,
                                prefixIcon: const Icon(
                                  Icons.lock_outline_rounded,
                                ),
                                suffixIcon: IconButton(
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                  icon: Icon(
                                    _obscure
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                  ),
                                ),
                              ),
                              validator: (value) => (value ?? '').length < 8
                                  ? l10n.authPasswordTooShort
                                  : null,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: NexoraSpace.lg),
                      FilledButton(
                        onPressed: session.authBusy ? null : _submit,
                        child: session.authBusy
                            ? const SizedBox.square(
                                dimension: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : Text(_signUp ? l10n.authSignUp : l10n.authSignIn),
                      ),
                      const SizedBox(height: NexoraSpace.md),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _signUp ? l10n.authHaveAccount : l10n.authSignIn,
                            style: context.texts.bodySmall,
                          ),
                          TextButton(
                            onPressed: () {
                              ref
                                  .read(sessionProvider.notifier)
                                  .clearAuthMessage();
                              setState(() => _signUp = !_signUp);
                            },
                            child: Text(
                              _signUp ? l10n.authSignIn : l10n.authCreateOne,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.lg),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.lock_outline_rounded,
                            size: 14,
                            color: context.colors.onSurfaceVariant,
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              l10n.authSecureNote,
                              style: context.texts.bodySmall,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: NexoraSpace.sm),
                      Center(
                        child: TextButton.icon(
                          onPressed: () => context.push('/connection'),
                          icon: const Icon(Icons.dns_outlined, size: 18),
                          label: Text(l10n.connectionTitle),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              top: NexoraSpace.sm,
              right: NexoraSpace.md,
              child: _LanguageButton(
                language:
                    preferences.locale?.languageCode ??
                    Localizations.localeOf(context).languageCode,
                onChanged: (code) => ref
                    .read(preferencesProvider.notifier)
                    .setLocale(code == null ? null : Locale(code)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _messageFor(String message) {
    if (message == 'auth_failed') return context.l10n.authFailed;
    return message;
  }
}

class _AuthBanner extends StatelessWidget {
  const _AuthBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(NexoraSpace.md),
    decoration: BoxDecoration(
      color: context.isDark ? const Color(0xFF3E1B1B) : NexoraColors.dangerSoft,
      borderRadius: BorderRadius.circular(NexoraRadius.field),
      border: Border.all(color: context.colors.error.withValues(alpha: 0.35)),
    ),
    child: Row(
      children: [
        Icon(Icons.error_outline_rounded, color: context.colors.error),
        const SizedBox(width: NexoraSpace.sm),
        Expanded(
          child: Text(
            message,
            style: context.texts.bodySmall?.copyWith(
              color: context.colors.error,
            ),
          ),
        ),
      ],
    ),
  );
}

class _BrandMark extends StatelessWidget {
  const _BrandMark();

  @override
  Widget build(BuildContext context) => Row(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.asset(
          'assets/images/logo-icon.png',
          width: 52,
          height: 44,
          fit: BoxFit.contain,
        ),
      ),
      const SizedBox(width: NexoraSpace.md),
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Nexora', style: context.texts.headlineMedium),
          Text(
            context.l10n.appTagline,
            style: context.texts.bodySmall?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    ],
  );
}

class _LanguageButton extends StatelessWidget {
  const _LanguageButton({required this.language, required this.onChanged});

  final String language;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) => PopupMenuButton<String>(
    tooltip: context.l10n.commonLanguage,
    icon: const Icon(Icons.language_rounded),
    onSelected: (value) => onChanged(value == 'system' ? null : value),
    itemBuilder: (context) => [
      PopupMenuItem(value: 'system', child: Text(context.l10n.commonAll)),
      const PopupMenuItem(value: 'en', child: Text('English')),
      const PopupMenuItem(value: 'fr', child: Text('Français')),
      const PopupMenuItem(value: 'ar', child: Text('العربية')),
    ],
  );
}
