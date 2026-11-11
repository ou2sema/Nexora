import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../errors/api_exception.dart';
import '../money/money.dart';
import '../theme/nexora_theme.dart';
import 'failure_text.dart';

extension L10nContext on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}

extension ThemeContext on BuildContext {
  ColorScheme get colors => Theme.of(this).colorScheme;
  TextTheme get texts => Theme.of(this).textTheme;
  bool get isDark => Theme.of(this).brightness == Brightness.dark;
}

class NexoraCard extends StatelessWidget {
  const NexoraCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final decorated = DecoratedBox(
      decoration: BoxDecoration(
        color: color ?? context.colors.surface,
        borderRadius: BorderRadius.circular(NexoraRadius.card),
        border: Border.all(color: context.colors.outline),
      ),
      child: Padding(padding: padding, child: child),
    );
    final card = onTap == null
        ? decorated
        : Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(NexoraRadius.card),
              onTap: onTap,
              child: decorated,
            ),
          );
    return card;
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: NexoraSpace.sm),
    child: Row(
      children: [
        Expanded(child: Text(title, style: context.texts.titleMedium)),
        if (actionLabel != null)
          TextButton(onPressed: onAction, child: Text(actionLabel!)),
      ],
    ),
  );
}

enum PillTone { neutral, primary, success, warning, danger }

class StatusPill extends StatelessWidget {
  const StatusPill({
    super.key,
    required this.label,
    this.tone = PillTone.neutral,
  });

  final String label;
  final PillTone tone;

  @override
  Widget build(BuildContext context) {
    final dark = context.isDark;
    final (background, foreground) = switch (tone) {
      PillTone.primary => (
        dark ? NexoraColors.darkPrimarySoft : NexoraColors.primarySoft,
        dark ? const Color(0xFFB9BAFF) : NexoraColors.primaryPressed,
      ),
      PillTone.success => (
        dark ? const Color(0xFF123A2C) : NexoraColors.successSoft,
        dark ? const Color(0xFF66D7A6) : NexoraColors.success,
      ),
      PillTone.warning => (
        dark ? const Color(0xFF3B2E12) : NexoraColors.warningSoft,
        dark ? const Color(0xFFE8C06A) : NexoraColors.warning,
      ),
      PillTone.danger => (
        dark ? const Color(0xFF3E1B1B) : NexoraColors.dangerSoft,
        dark ? const Color(0xFFFF9A9A) : NexoraColors.danger,
      ),
      PillTone.neutral => (
        dark ? NexoraColors.darkSurfaceRaised : NexoraColors.background,
        context.colors.onSurfaceVariant,
      ),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(NexoraRadius.chip),
      ),
      child: Text(
        label,
        style: context.texts.labelMedium?.copyWith(
          color: foreground,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class MoneyText extends StatelessWidget {
  const MoneyText(this.minor, {super.key, this.style, this.withCode = true});

  final int minor;
  final TextStyle? style;
  final bool withCode;

  @override
  Widget build(BuildContext context) => Text(
    Money.format(minor, withCode: withCode),
    style: (style ?? context.texts.titleMedium)?.copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    ),
    textDirection: TextDirection.ltr,
  );
}

class QuantityText extends StatelessWidget {
  const QuantityText(this.quantity, {super.key, this.style});

  final num quantity;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) => Text(
    formatQuantity(quantity),
    style: (style ?? context.texts.bodyMedium)?.copyWith(
      fontFeatures: const [FontFeature.tabularFigures()],
    ),
    textDirection: TextDirection.ltr,
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String? message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(NexoraSpace.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 44, color: context.colors.onSurfaceVariant),
          const SizedBox(height: NexoraSpace.md),
          Text(
            title,
            style: context.texts.titleMedium,
            textAlign: TextAlign.center,
          ),
          if (message != null) ...[
            const SizedBox(height: NexoraSpace.sm),
            Text(
              message!,
              style: context.texts.bodyMedium?.copyWith(
                color: context.colors.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          if (onAction != null && actionLabel != null) ...[
            const SizedBox(height: NexoraSpace.lg),
            FilledButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    ),
  );
}

class FailureView extends StatelessWidget {
  const FailureView({
    super.key,
    required this.failure,
    this.onRetry,
    this.compact = false,
  });

  final ApiException failure;
  final VoidCallback? onRetry;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final message = failureText(context.l10n, failure);
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? NexoraSpace.lg : NexoraSpace.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              failure.kind == ApiFailureKind.network
                  ? Icons.wifi_off_rounded
                  : Icons.error_outline_rounded,
              size: 40,
              color: context.colors.error,
            ),
            const SizedBox(height: NexoraSpace.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: context.texts.bodyMedium,
            ),
            if (failure.requestId != null) ...[
              const SizedBox(height: NexoraSpace.xs),
              Text(
                context.l10n.errorRequestId(failure.requestId!),
                style: context.texts.bodySmall,
                textDirection: TextDirection.ltr,
              ),
            ],
            if (onRetry != null) ...[
              const SizedBox(height: NexoraSpace.lg),
              OutlinedButton(
                onPressed: onRetry,
                child: Text(context.l10n.commonRetry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class AsyncPane<T> extends StatelessWidget {
  const AsyncPane({
    super.key,
    required this.value,
    required this.builder,
    this.onRetry,
    this.loading,
  });

  final AsyncValue<T> value;
  final Widget Function(T data) builder;
  final VoidCallback? onRetry;
  final Widget? loading;

  @override
  Widget build(BuildContext context) => value.when(
    data: builder,
    loading: () =>
        loading ??
        const Center(
          child: Padding(
            padding: EdgeInsets.all(32),
            child: CircularProgressIndicator(),
          ),
        ),
    error: (error, _) => error is ApiException
        ? FailureView(failure: error, onRetry: onRetry)
        : FailureView(
            failure: ApiException(
              kind: ApiFailureKind.unknown,
              code: 'unknown',
              message: error.toString(),
            ),
            onRetry: onRetry,
          ),
  );
}

class KeyValueRow extends StatelessWidget {
  const KeyValueRow({
    super.key,
    required this.label,
    required this.value,
    this.tone,
  });

  final String label;
  final String value;
  final PillTone? tone;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            label,
            style: context.texts.bodyMedium?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
        ),
        const SizedBox(width: NexoraSpace.md),
        tone == null
            ? Text(
                value,
                style: context.texts.bodyMedium,
                textAlign: TextAlign.end,
              )
            : StatusPill(label: value, tone: tone!),
      ],
    ),
  );
}

class SearchField extends StatelessWidget {
  const SearchField({
    super.key,
    required this.hint,
    this.controller,
    this.onChanged,
    this.onSubmitted,
  });

  final String hint;
  final TextEditingController? controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) => TextField(
    controller: controller,
    onChanged: onChanged,
    onSubmitted: onSubmitted,
    textInputAction: TextInputAction.search,
    decoration: InputDecoration(
      hintText: hint,
      prefixIcon: const Icon(Icons.search_rounded),
      suffixIcon: controller == null
          ? null
          : ListenableBuilder(
              listenable: controller!,
              builder: (context, _) => controller!.text.isEmpty
                  ? const SizedBox.shrink()
                  : IconButton(
                      tooltip: context.l10n.commonClear,
                      icon: const Icon(Icons.close_rounded),
                      onPressed: () {
                        controller!.clear();
                        onChanged?.call('');
                      },
                    ),
            ),
    ),
  );
}

class LoadMoreButton extends StatelessWidget {
  const LoadMoreButton({super.key, required this.onPressed, this.busy = false});

  final VoidCallback onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: NexoraSpace.md),
    child: OutlinedButton(
      onPressed: busy ? null : onPressed,
      child: busy
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Text(context.l10n.commonLoadMore),
    ),
  );
}

class ListPager extends StatelessWidget {
  const ListPager({
    super.key,
    required this.page,
    required this.pages,
    this.onPrevious,
    this.onNext,
  });

  final int page;
  final int pages;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    if (pages <= 1) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: NexoraSpace.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          IconButton(
            tooltip: context.l10n.commonPrevious,
            onPressed: onPrevious,
            icon: const Icon(Icons.chevron_left_rounded),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NexoraSpace.md),
            child: Text(
              context.l10n.commonPageOf(page, pages),
              style: context.texts.bodySmall,
              textDirection: TextDirection.ltr,
            ),
          ),
          IconButton(
            tooltip: context.l10n.commonNext,
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right_rounded),
          ),
        ],
      ),
    );
  }
}
