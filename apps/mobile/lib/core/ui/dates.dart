import 'package:intl/intl.dart';

/// Dates print with Latin digits in every language. The pattern is deliberately
/// numeric so an Arabic device never switches the ledger to another numeral set.
String formatDate(DateTime? date) =>
    date == null ? '—' : DateFormat('dd MMM yyyy').format(date.toLocal());

String formatDateTime(DateTime? date) => date == null
    ? '—'
    : DateFormat('dd MMM yyyy · HH:mm').format(date.toLocal());

String formatTime(DateTime? date) =>
    date == null ? '—' : DateFormat('HH:mm').format(date.toLocal());

String isoDate(DateTime date) => DateFormat('yyyy-MM-dd').format(date);

DateTime? parseIsoDate(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim());
}
