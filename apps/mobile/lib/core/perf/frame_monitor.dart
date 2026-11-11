import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart';

/// Logs build/raster timings in builds made with `--dart-define=PERF_LOG=true`.
/// The flag compiles the whole monitor away in normal builds.
class FrameMonitor {
  FrameMonitor._();

  static const enabled = bool.fromEnvironment('PERF_LOG');
  static final List<FrameTiming> _window = [];
  static DateTime? _started;
  static DateTime _lastFlush = DateTime.now();

  static void install() {
    if (!enabled) return;
    _started = DateTime.now();
    SchedulerBinding.instance.addTimingsCallback(_onTimings);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final started = _started;
      if (started == null) return;
      debugPrint(
        '[perf] first-frame ${DateTime.now().difference(started).inMilliseconds}ms',
      );
    });
  }

  static void _onTimings(List<FrameTiming> timings) {
    _window.addAll(timings);
    final now = DateTime.now();
    if (now.difference(_lastFlush) < const Duration(seconds: 3)) return;

    var build = 0.0;
    var raster = 0.0;
    var worst = 0.0;
    var janky = 0;
    for (final frame in _window) {
      final buildMs = frame.buildDuration.inMicroseconds / 1000;
      final rasterMs = frame.rasterDuration.inMicroseconds / 1000;
      final total = buildMs + rasterMs;
      build += buildMs;
      raster += rasterMs;
      if (total > worst) worst = total;
      if (total > 16.67) janky++;
    }
    final frames = _window.length;
    final jankPercent = frames == 0 ? 0 : (janky * 100 / frames).round();
    debugPrint(
      '[perf] frames=$frames buildAvg=${(build / frames).toStringAsFixed(1)}ms '
      'rasterAvg=${(raster / frames).toStringAsFixed(1)}ms '
      'worst=${worst.toStringAsFixed(1)}ms janky=$jankPercent%',
    );
    _window.clear();
    _lastFlush = now;
  }
}
