/// TND money is stored as integer millimes (three decimals). These helpers keep
/// every screen on the same format and reject amounts the API would refuse.
abstract final class Money {
  static const int scale = 1000;
  static const String code = 'TND';

  /// Groups the integer part with commas and always prints three decimals.
  static String format(int minor, {bool withCode = true}) {
    final negative = minor < 0;
    final absolute = minor.abs();
    final whole = absolute ~/ scale;
    final fraction = (absolute % scale).toString().padLeft(3, '0');
    final grouped = _group(whole.toString());
    return '${negative ? '-' : ''}$grouped.$fraction${withCode ? ' $code' : ''}';
  }

  /// The value as typed into an amount field, without grouping.
  static String input(int minor) => (minor / scale).toStringAsFixed(3);

  static String tndFromDouble(double amount) =>
      format((amount * scale).round());

  /// Accepts `12,5`, `12.500` or `1 234.500`; returns null when the amount is
  /// negative, not a number, or finer than one millime.
  static int? parse(String raw) {
    final normalized = raw
        .trim()
        .replaceAll(' ', '')
        .replaceAll('\u00a0', '')
        .replaceAll(',', '.');
    if (normalized.isEmpty) return null;
    if (!RegExp(r'^\d+(\.\d{1,3})?$').hasMatch(normalized)) return null;
    final amount = double.tryParse(normalized);
    if (amount == null || !amount.isFinite) return null;
    return (amount * scale).round();
  }

  /// Quantities accept at most four decimals and must be strictly positive.
  static double? parseQuantity(String raw) {
    final normalized = raw.trim().replaceAll(' ', '').replaceAll(',', '.');
    if (!RegExp(r'^\d+(\.\d{1,4})?$').hasMatch(normalized)) return null;
    final value = double.tryParse(normalized);
    return value != null && value > 0 ? value : null;
  }

  /// Tax rates accept at most four decimals between 0 and 100.
  static double? parsePercent(String raw) {
    final normalized = raw.trim().replaceAll(' ', '').replaceAll(',', '.');
    if (!RegExp(r'^\d{1,3}(\.\d{1,4})?$').hasMatch(normalized)) return null;
    final value = double.tryParse(normalized);
    return value != null && value >= 0 && value <= 100 ? value : null;
  }

  static String _group(String digits) {
    final buffer = StringBuffer();
    for (var index = 0; index < digits.length; index++) {
      if (index > 0 && (digits.length - index) % 3 == 0) buffer.write(',');
      buffer.write(digits[index]);
    }
    return buffer.toString();
  }
}

/// Formats quantities and counts with Latin digits in every locale, as the
/// owner asked for Arabic. Trailing decimal zeroes are dropped.
String formatQuantity(num value, {int maxDecimals = 4}) {
  if (!value.isFinite) return '0';
  var text = value.toStringAsFixed(maxDecimals);
  if (text.contains('.')) {
    text = text.replaceFirst(RegExp(r'0+$'), '');
    text = text.replaceFirst(RegExp(r'\.$'), '');
  }
  final negative = text.startsWith('-');
  final parts = (negative ? text.substring(1) : text).split('.');
  final grouped = _groupDigits(parts.first);
  final joined = parts.length > 1 ? '$grouped.${parts[1]}' : grouped;
  return negative ? '-$joined' : joined;
}

int? countOrNull(num value) => value.isFinite ? value.round() : null;

String _groupDigits(String digits) {
  final buffer = StringBuffer();
  for (var index = 0; index < digits.length; index++) {
    if (index > 0 && (digits.length - index) % 3 == 0) buffer.write(',');
    buffer.write(digits[index]);
  }
  return buffer.toString();
}
