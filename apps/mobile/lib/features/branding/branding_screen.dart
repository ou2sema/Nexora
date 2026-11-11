import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/app_providers.dart';
import '../../core/theme/nexora_theme.dart';
import '../../core/ui/failure_text.dart';
import '../../core/ui/widgets.dart';

const int _maxLogoBytes = 409600;

class BrandingScreen extends ConsumerStatefulWidget {
  const BrandingScreen({super.key});

  @override
  ConsumerState<BrandingScreen> createState() => _BrandingScreenState();
}

class _BrandingScreenState extends ConsumerState<BrandingScreen> {
  Uint8List? _bytes;
  String? _mime;
  bool _loading = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    final logo = ref.read(sessionProvider).membership?.logo;
    if (logo != null) {
      Future.microtask(() => _load(logo.mime));
    }
  }

  Future<void> _load(String mime) async {
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _loading = true);
    try {
      final file = await ref
          .read(nexoraApiProvider)
          .downloadLogo(organizationId, mime: mime);
      if (!mounted) return;
      setState(() {
        _bytes = file.bytes;
        _mime = mime;
      });
    } catch (_) {
      // A missing preview does not block replacing or removing the logo.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickAndUpload() async {
    final l10n = context.l10n;
    final picked = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      maxWidth: 1024,
      maxHeight: 1024,
      imageQuality: 90,
    );
    if (picked == null || !mounted) return;
    final bytes = await picked.readAsBytes();
    if (!mounted) return;
    final mime = _sniff(bytes);
    if (mime == null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.brandingUnsupported)));
      return;
    }
    if (bytes.length > _maxLogoBytes) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.brandingTooLarge)));
      return;
    }
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      final summary = await ref
          .read(nexoraApiProvider)
          .uploadLogo(organizationId, bytes, mime: mime);
      await ref.read(sessionProvider.notifier).refreshWorkspace();
      if (!mounted) return;
      setState(() {
        _bytes = bytes;
        _mime = summary.mime;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.brandingUploaded)));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failureText(l10n, failureOf(error)))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.brandingRemove),
        content: Text(l10n.brandingRemoveConfirm),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.commonCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(l10n.commonRemove),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final organizationId = ref.read(organizationIdProvider);
    if (organizationId == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(nexoraApiProvider).removeLogo(organizationId);
      await ref.read(sessionProvider.notifier).refreshWorkspace();
      if (!mounted) return;
      setState(() {
        _bytes = null;
        _mime = null;
      });
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.brandingRemoved)));
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(failureText(l10n, failureOf(error)))),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _sniff(Uint8List bytes) {
    if (bytes.length >= 4 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47) {
      return 'image/png';
    }
    if (bytes.length >= 3 &&
        bytes[0] == 0xFF &&
        bytes[1] == 0xD8 &&
        bytes[2] == 0xFF) {
      return 'image/jpeg';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final role = ref.watch(activeRoleProvider);
    final canManage = role.canManageBranding;
    final logo = ref.watch(sessionProvider).membership?.logo;
    final hasLogo = _bytes != null || logo != null;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.brandingTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            NexoraCard(
              padding: const EdgeInsets.all(NexoraSpace.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(l10n.brandingLogo, style: context.texts.titleMedium),
                  const SizedBox(height: NexoraSpace.lg),
                  Center(
                    child: Container(
                      width: 180,
                      height: 140,
                      decoration: BoxDecoration(
                        color: context.colors.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(NexoraRadius.card),
                        border: Border.all(color: context.colors.outline),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: _loading
                          ? const Center(child: CircularProgressIndicator())
                          : _bytes == null
                          ? Icon(
                              Icons.image_outlined,
                              size: 44,
                              color: context.colors.onSurfaceVariant,
                            )
                          : Image.memory(_bytes!, fit: BoxFit.contain),
                    ),
                  ),
                  const SizedBox(height: NexoraSpace.md),
                  Text(
                    l10n.brandingHint,
                    style: context.texts.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                  if (_mime != null) ...[
                    const SizedBox(height: NexoraSpace.xs),
                    Text(
                      _mime!,
                      style: context.texts.bodySmall,
                      textAlign: TextAlign.center,
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ],
              ),
            ),
            if (canManage) ...[
              const SizedBox(height: NexoraSpace.lg),
              FilledButton.icon(
                onPressed: _busy ? null : _pickAndUpload,
                icon: const Icon(Icons.upload_rounded),
                label: Text(
                  hasLogo ? l10n.brandingReplace : l10n.brandingUpload,
                ),
              ),
              if (hasLogo) ...[
                const SizedBox(height: NexoraSpace.sm),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _remove,
                  icon: const Icon(Icons.delete_outline_rounded),
                  label: Text(l10n.brandingRemove),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
