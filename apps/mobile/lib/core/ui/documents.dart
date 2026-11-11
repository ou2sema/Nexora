import 'dart:io';

import 'package:flutter/material.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../api/api_client.dart';
import '../theme/nexora_theme.dart';
import 'failure_text.dart';
import 'widgets.dart';

/// Fetches a server-rendered document, writes it under the app documents
/// directory, and offers it to the device. The server chooses the filename.
Future<String?> downloadDocument(
  BuildContext context,
  Future<DownloadedFile> Function() load, {
  bool share = false,
}) async {
  final l10n = context.l10n;
  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (context) => const PopScope(
      canPop: false,
      child: Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(NexoraSpace.xl),
            child: SizedBox.square(
              dimension: 28,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ),
        ),
      ),
    ),
  );
  try {
    final document = await load();
    final directory = await getApplicationDocumentsDirectory();
    final path =
        '${directory.path}${Platform.pathSeparator}${document.filename}';
    await File(path).writeAsBytes(document.bytes, flush: true);
    if (!context.mounted) return path;
    Navigator.of(context, rootNavigator: true).pop();
    if (share) {
      await SharePlus.instance.share(ShareParams(files: [XFile(path)]));
    }
    if (!context.mounted) return path;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.commonSavedToPhone),
        action: SnackBarAction(
          label: share ? l10n.commonShare : l10n.commonOpen,
          onPressed: () {
            if (share) {
              SharePlus.instance.share(ShareParams(files: [XFile(path)]));
            } else {
              openLocalFile(context, path);
            }
          },
        ),
      ),
    );
    return path;
  } catch (error) {
    if (!context.mounted) return null;
    Navigator.of(context, rootNavigator: true).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(failureText(l10n, failureOf(error)))),
    );
    return null;
  }
}

Future<void> openLocalFile(BuildContext context, String path) async {
  final result = await OpenFilex.open(path);
  if (result.type != ResultType.done && context.mounted) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(context.l10n.documentsNoApp)));
  }
}
