import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/config/connection_settings.dart';
import 'core/perf/frame_monitor.dart';
import 'core/storage/secure_session_storage.dart';
import 'core/theme/nexora_theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  FrameMonitor.install();
  final config = AppConfig.fromEnvironment();
  if (!config.isConfigured) {
    runApp(UnconfiguredApp(config: config));
    return;
  }
  final connection = await ConnectionController.load();
  await Supabase.initialize(
    url: config.supabaseUrl,
    publishableKey: config.supabaseKey,
    authOptions: FlutterAuthClientOptions(localStorage: SecureSessionStorage()),
  );
  runApp(
    ProviderScope(
      overrides: [initialConnectionProvider.overrideWithValue(connection)],
      child: const NexoraApp(),
    ),
  );
}

/// A build without `--dart-define` still opens and says exactly what is missing
/// instead of pointing at the wrong API.
class UnconfiguredApp extends StatelessWidget {
  const UnconfiguredApp({super.key, required this.config});

  final AppConfig config;

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: buildNexoraTheme(dark: false, languageCode: 'en'),
    darkTheme: buildNexoraTheme(dark: true, languageCode: 'en'),
    home: Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(NexoraSpace.xl),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    config.label,
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: NexoraSpace.md),
                  const Text(
                    'This build has no Supabase configuration. Rebuild with the '
                    'publishable settings of the environment you are testing:',
                  ),
                  const SizedBox(height: NexoraSpace.md),
                  const SelectableText(
                    'flutter run --flavor dev \\\n'
                    '  --dart-define=APP_FLAVOR=dev \\\n'
                    '  --dart-define=SUPABASE_URL=https://<project>.supabase.co \\\n'
                    '  --dart-define=SUPABASE_ANON_KEY=<publishable-anon-key> \\\n'
                    '  --dart-define=API_BASE_URL=http://10.0.2.2:4100/api/v1',
                    style: TextStyle(fontFamily: 'monospace', fontSize: 12),
                  ),
                  const SizedBox(height: NexoraSpace.md),
                  const Text(
                    'Only the publishable key belongs in the app. The service-role '
                    'key, database password and JWT secret stay on the API.',
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
